import * as THREE from 'three';
import { to3D } from '../three-page/axisMapping.js';
import {
  DEFAULT_BOARD_THICKNESS, DEFAULT_BOARD_COLOR, BOARD_TOP_Y, DEFAULT_NAIL_COLOR, SHAFT_RADIUS, HEAD_RADIUS, buildNailGeometry,
} from '../three-page/SceneSync.js';
import { buildClosedWeaveLineObject } from '../three-page/weaveLineBuilder.js';
import { resampleClosedOutline } from '../core/bezierOutline.js';
import { transformAnchors } from '../core/shapeTransform.js';

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
  constructor(scene, boardSize) {
    this.scene = scene;
    this.boardSize = boardSize;
    this.lineResolution = new THREE.Vector2(1, 1);
    this.instanceLines = new Map(); // instance id -> LineSegments2
    this.instanceNails = new Map(); // instance id -> InstancedMesh (one nail per resampled outline point)
    // One shared silhouette for every nail - the exact same unit-height
    // geometry/radii the grid page's 3D view uses, scaled per instance in Y.
    this.nailGeometry = buildNailGeometry(SHAFT_RADIUS, HEAD_RADIUS);
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
   * transform and its own height/stroke-weight (each instance's own
   * `shapeSnapshot.height`/`.weight` override, or the board's global
   * defaults when either is `null` - see `FreeformShape`'s own doc).
   * @param {{id:string, shapeSnapshot: import('../models/FreeformShape.js').FreeformShape, position:{x:number,y:number}, rotationRadians:number, scale:number}[]} instances
   * @param {number} globalHeight the Arrange board's own default height
   * @param {number} globalWeight the Arrange board's own default stroke weight
   * @param {boolean} globalNailsVisible whether nails show for instances without their own override
   */
  syncAll(instances, globalHeight, globalWeight, globalNailsVisible = true) {
    const currentIds = new Set(instances.map((i) => i.id));
    for (const id of new Set([...this.instanceLines.keys(), ...this.instanceNails.keys()])) {
      if (!currentIds.has(id)) this.#disposeInstance(id);
    }

    for (const instance of instances) {
      this.#disposeInstance(instance.id);
      const { lines, nails } = this.#buildInstanceObjects(instance, globalHeight, globalWeight, globalNailsVisible);
      this.scene.add(nails);
      this.instanceNails.set(instance.id, nails);
      if (!lines) continue;
      this.scene.add(lines);
      this.instanceLines.set(instance.id, lines);
    }
  }

  #buildInstanceObjects(instance, globalHeight, globalWeight, globalNailsVisible) {
    const anchors = transformAnchors(instance.shapeSnapshot.anchors, {
      position: instance.position,
      rotationRadians: instance.rotationRadians,
      scale: instance.scale,
    });
    const nails = resampleClosedOutline(anchors, instance.shapeSnapshot.nailCount);
    const maxHeight = instance.shapeSnapshot.height ?? globalHeight;
    const weight = instance.shapeSnapshot.weight ?? globalWeight;

    const lines = buildClosedWeaveLineObject({
      cellCorners: nails,
      n: 0,
      leap: instance.shapeSnapshot.leap,
      colors: instance.shapeSnapshot.colors,
      weight,
      maxHeight,
      toWorldPosition: (point2, height) => this.toWorldPosition(point2, height),
      lineResolution: this.lineResolution,
      reverseLayers: true,
    });
    const nailMesh = this.#buildNailMesh(nails, maxHeight, instance.nailScale ?? 1);
    nailMesh.visible = instance.nailsVisible ?? globalNailsVisible;
    return { lines, nails: nailMesh };
  }

  /** One standing nail per outline point, as tall as the shape's max string height - same look as the grid page's nails. */
  #buildNailMesh(points, height, thickness) {
    const mesh = new THREE.InstancedMesh(this.nailGeometry, this.nailMaterial, points.length);
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

  #buildBoard() {
    const geometry = new THREE.BoxGeometry(this.boardSize, DEFAULT_BOARD_THICKNESS, this.boardSize);
    const material = new THREE.MeshStandardMaterial({ color: DEFAULT_BOARD_COLOR });
    this.boardMesh = new THREE.Mesh(geometry, material);
    this.boardMesh.position.set(0, BOARD_TOP_Y - DEFAULT_BOARD_THICKNESS / 2, 0);
    this.scene.add(this.boardMesh);
  }

  dispose() {
    this.scene.remove(this.boardMesh);
    this.boardMesh.geometry.dispose();
    this.boardMesh.material.dispose();
    for (const id of new Set([...this.instanceLines.keys(), ...this.instanceNails.keys()])) this.#disposeInstance(id);
    this.nailGeometry.dispose();
    this.nailMaterial.dispose();
  }
}
