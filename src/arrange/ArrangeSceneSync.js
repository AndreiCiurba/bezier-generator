import * as THREE from 'three';
import { to3D } from '../three-page/axisMapping.js';
import {
  DEFAULT_BOARD_THICKNESS, DEFAULT_BOARD_COLOR, BOARD_TOP_Y, DEFAULT_NAIL_COLOR, SHAFT_RADIUS, HEAD_RADIUS, buildNailGeometry,
} from '../three-page/SceneSync.js';
import { buildClosedWeaveLineObject, assembleWeaveLineObject } from '../three-page/weaveLineBuilder.js';
import { threadGeometry, connectionStrands, mmToWorld, nailHasHead } from '../core/threadWrap.js';
import { worldColorLayerHeight } from '../core/curveZLayers.js';
import { isCardioid } from '../models/shapeFromJSON.js';
import { placedNails, placedSegments } from './placedShape.js';

/**
 * Owns every Three.js object on the Arrange board: a flat board plane (no
 * nail-grid lattice - freeform shapes carry their own nails) plus one
 * `LineSegments2` per placed `ArrangedShapeStore` instance, built via the
 * *exact* `weaveLineBuilder.js` helper `SceneSync.js` uses for the grid
 * page's own closed-polygon weave cells - the whole point of extracting that
 * helper (see this repo's `docs/epic-freeform-weave.md`).
 *
 * No per-id incremental reconciliation like `SceneSync#syncCurves` - the
 * Arrange board expects a handful to a few dozen instances, not the grid
 * page's potentially-hundreds of weave cells, so `syncAll` simply rebuilds
 * every instance's geometry on every store change. Simpler, and cheap enough
 * at this scale; worth revisiting only if that assumption stops holding.
 */
export class ArrangeSceneSync {
  constructor(scene, boardWidth, boardDepth = boardWidth, { color = DEFAULT_BOARD_COLOR, thickness = DEFAULT_BOARD_THICKNESS } = {}) {
    this.scene = scene;
    this.boardWidth = boardWidth;
    this.boardDepth = boardDepth;
    this.boardColor = color;
    this.boardThickness = thickness;
    this.lineResolution = new THREE.Vector2(1, 1);
    this.instanceLines = new Map(); // instance id -> LineSegments2
    this.instanceNails = new Map(); // instance id -> InstancedMesh (one nail per resampled outline point)
    // One shared silhouette for every nail - the exact same unit-height
    // geometry/radii the grid page's 3D view uses, scaled per instance in Y.
    this.nailGeometry = buildNailGeometry(SHAFT_RADIUS, HEAD_RADIUS);
    this.headlessNailGeometry = buildNailGeometry(SHAFT_RADIUS, SHAFT_RADIUS); // 3 mm and wider: plain rods
    this.nailMaterial = new THREE.MeshStandardMaterial({ color: DEFAULT_NAIL_COLOR });
    this.#buildBoard();
  }

  /** Maps a 2D design-space point (+ optional world height) into 3D world space - the Arrange board has no grid-bounding-box origin shift to apply (the board is always centered at world X/Z = 0), so this is just `axisMapping#to3D` directly. */
  toWorldPosition(point2, height = 0) {
    return to3D(point2, height);
  }

  /** Keeps every instance's fat-line width correct in screen-space pixels after a renderer resize. */
  setViewportSize(width, height) {
    this.lineResolution.set(width, height);
    for (const object of this.instanceLines.values()) {
      object.material.resolution.set(width, height);
    }
  }


  /**
   * Rebuilds every placed instance's woven geometry from the current
   * `ArrangedShapeStore#instances` - disposes any instance id no longer
   * present, then rebuilds every currently-present one against its own
   * transform and its own height (`shapeSnapshot.height`, or the board's
   * global height when `null`). Strings are drawn as real thread: the global
   * thread width in world units (10 units = 1 mm), two strands per
   * connection wrapped around nails of the global diameter (times the
   * instance's own nail scale) - see core/threadWrap.js.
   * @param {{id:string, shapeSnapshot: import('../models/FreeformShape.js').FreeformShape, position:{x:number,y:number}, rotationRadians:number, scale:number}[]} instances
   * @param {number} globalHeight the Arrange board's own default height
   * @param {{threadWidthMm:number, nailDiameterMm:number, technique:string}} threadSettings
   * @param {boolean} globalNailsVisible whether nails show for instances without their own override
   */
  syncAll(instances, globalHeight, threadSettings, globalNailsVisible = true) {
    const currentIds = new Set(instances.map((i) => i.id));
    for (const id of new Set([...this.instanceLines.keys(), ...this.instanceNails.keys()])) {
      if (!currentIds.has(id)) this.#disposeInstance(id);
    }

    for (const instance of instances) {
      this.#disposeInstance(instance.id);
      const { lines, nails } = this.#buildInstanceObjects(instance, globalHeight, threadSettings, globalNailsVisible);
      this.scene.add(nails);
      this.instanceNails.set(instance.id, nails);
      if (!lines) continue;
      this.scene.add(lines);
      this.instanceLines.set(instance.id, lines);
    }
  }

  #buildInstanceObjects(instance, globalHeight, threadSettings, globalNailsVisible) {
    const nails = placedNails(instance);
    const maxHeight = instance.shapeSnapshot.height ?? globalHeight;
    const thread = threadGeometry(threadSettings, instance.nailScale ?? 1);

    const lines = isCardioid(instance.shapeSnapshot)
      ? this.#buildCardioidLines(instance, nails, maxHeight, thread)
      : buildClosedWeaveLineObject({
          cellCorners: nails,
          n: 0,
          leap: instance.shapeSnapshot.leap,
          colors: instance.shapeSnapshot.colors,
          weight: 1, // unused: worldLineWidth below sets the width
          worldLineWidth: thread.lineWidth,
          wrap: { radius: thread.wrapRadius, technique: thread.technique },
          maxHeight,
          toWorldPosition: (point2, height) => this.toWorldPosition(point2, height),
          lineResolution: this.lineResolution,
          // Old-rule shapes put their widest layer first, so they stack reversed; center-out shapes already start at the board.
          rule: instance.shapeSnapshot.weaveRule,
          // With the "fit layers to nails" option, a layer's height is where it would be if the shape had nails / 2 colors.
          layerSlots: instance.fitLayersToNails ? Math.floor(instance.shapeSnapshot.nailCount / 2) : null,
          reverseLayers: instance.shapeSnapshot.weaveRule === 'legacy',
      });
    const hasHead = nailHasHead(threadSettings.nailDiameterMm * (instance.nailScale ?? 1));
    const nailMesh = this.#buildNailMesh(nails, maxHeight, thread.nailRadius / SHAFT_RADIUS, hasHead);
    nailMesh.visible = instance.nailsVisible ?? globalNailsVisible;
    return { lines, nails: nailMesh };
  }

  /**
   * A placed cardioid: each of its layers at its own height (layer 0 at the
   * board, like the Cardioid page), each run of a layer's stack `runGapMm`
   * above the one before, every thread as its two real strands (one at the
   * end of a run).
   */
  #buildCardioidLines(instance, nails, maxHeight, thread) {
    const { layerCount, runGapMm } = instance.shapeSnapshot;
    const runGap = mmToWorld(runGapMm);
    const positions = [];
    const vertexColors = [];
    const color = new THREE.Color();
    for (const { from, to, color: hex, layerIndex, stackIndex, single } of placedSegments(instance, nails)) {
      const y = worldColorLayerHeight(layerIndex, layerCount, 0, maxHeight) + stackIndex * runGap;
      color.set(hex);
      for (const strand of connectionStrands(from, to, thread.wrapRadius, thread.technique, single)) {
        const a = this.toWorldPosition(strand.from, y);
        const b = this.toWorldPosition(strand.to, y);
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
        vertexColors.push(color.r, color.g, color.b, color.r, color.g, color.b);
      }
    }
    return assembleWeaveLineObject(positions, vertexColors, 1, this.lineResolution, 1, thread.lineWidth);
  }


  /** One standing nail per outline point, as tall as the shape's max string height - same look as the grid page's nails, its shaft widened/narrowed by `thickness` to the real nail diameter. */
  #buildNailMesh(points, height, thickness, hasHead = true) {
    const mesh = new THREE.InstancedMesh(hasHead ? this.nailGeometry : this.headlessNailGeometry, this.nailMaterial, points.length);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(thickness, height, thickness);
    const position = new THREE.Vector3();
    points.forEach((point, i) => {
      const world = this.toWorldPosition(point, 0);
      position.set(world.x, world.y, world.z);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }

  #disposeInstance(id) {
    const nails = this.instanceNails.get(id);
    if (nails) {
      this.scene.remove(nails);
      nails.dispose(); // the instance buffer only - geometry/material are shared
      this.instanceNails.delete(id);
    }
    const object = this.instanceLines.get(id);
    if (!object) return;
    this.scene.remove(object);
    object.geometry.dispose();
    object.material.dispose();
    this.instanceLines.delete(id);
  }

  /** Resizes the board (world X = width, world Z = depth/"height" in the menu) - rebuilds just the board mesh, not the placed shapes. */
  setBoardSize(width, depth) {
    this.boardWidth = width;
    this.boardDepth = depth;
    this.#rebuildBoard();
  }

  /** The board's color and thickness (world units, 10 = 1 mm). Its top stays at the nails' base; it grows downwards. */
  setBoardAppearance(color, thickness) {
    this.boardColor = color;
    this.boardThickness = thickness;
    this.#rebuildBoard();
  }

  #rebuildBoard() {
    this.scene.remove(this.boardMesh);
    this.boardMesh.geometry.dispose();
    this.boardMesh.material.dispose();
    this.#buildBoard();
  }

  #buildBoard() {
    const geometry = new THREE.BoxGeometry(this.boardWidth, this.boardThickness, this.boardDepth);
    const material = new THREE.MeshStandardMaterial({ color: this.boardColor });
    this.boardMesh = new THREE.Mesh(geometry, material);
    this.boardMesh.position.set(0, BOARD_TOP_Y - this.boardThickness / 2, 0);
    this.scene.add(this.boardMesh);
  }

  dispose() {
    this.scene.remove(this.boardMesh);
    this.boardMesh.geometry.dispose();
    this.boardMesh.material.dispose();
    for (const id of new Set([...this.instanceLines.keys(), ...this.instanceNails.keys()])) this.#disposeInstance(id);
    this.nailGeometry.dispose();
    this.headlessNailGeometry.dispose();
    this.nailMaterial.dispose();
  }
}
