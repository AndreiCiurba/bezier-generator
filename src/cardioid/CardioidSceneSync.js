import * as THREE from 'three';
import { to3D } from '../three-page/axisMapping.js';
import {
  DEFAULT_BOARD_THICKNESS, DEFAULT_BOARD_COLOR, BOARD_TOP_Y, DEFAULT_NAIL_COLOR, SHAFT_RADIUS, HEAD_RADIUS, buildNailGeometry,
} from '../three-page/SceneSync.js';
import { assembleWeaveLineObject } from '../three-page/weaveLineBuilder.js';
import { worldColorLayerHeight } from '../core/curveZLayers.js';
import { circleNailPositions, layerChords, parallelStrings, wrapArc } from '../core/cardioidWeave.js';

const BOARD_MARGIN = 1.3; // board half-extent as a multiple of the circle radius

/**
 * Owns every Three.js object on the Cardioid board: a flat square board, one
 * standing nail per circle nail, and one `LineSegments2` per layer (each
 * layer has its own string weight, so its own material), built with the same
 * `assembleWeaveLineObject` the grid and Arrange pages use. Everything is
 * rebuilt from scratch on every settings change - a few thousand segments at
 * most, and far simpler than diffing.
 */
export class CardioidSceneSync {
  constructor(scene) {
    this.scene = scene;
    this.lineResolution = new THREE.Vector2(1, 1);
    this.layerLines = [];
    this.nailMesh = null;
    this.boardMesh = null;
    this.nailGeometry = buildNailGeometry(SHAFT_RADIUS, HEAD_RADIUS);
    this.nailMaterial = new THREE.MeshStandardMaterial({ color: DEFAULT_NAIL_COLOR });
  }

  /** Side length of the board for a given circle radius - also what the camera frames. */
  static boardSizeFor(radius) {
    return radius * 2 * BOARD_MARGIN;
  }

  setViewportSize(width, height) {
    this.lineResolution.set(width, height);
    for (const line of this.layerLines) line.material.resolution.set(width, height);
  }

  /**
   * @param {{
   *   nailCount:number, layerCount:number, leap:number, multiplier:number, radius:number,
   *   height:number, weight:number,
   *   colors: string[], nailsVisible:boolean, nailThickness:number, showWrap:boolean
   * }} settings `colors` are the enabled palette colors, one per color group
   */
  rebuild(settings) {
    this.#disposeContent();
    this.#buildBoard(CardioidSceneSync.boardSizeFor(settings.radius));

    const nails = circleNailPositions(settings.nailCount, settings.radius);
    this.#buildNails(nails, settings);
    this.#buildLayers(nails, settings);
  }

  #buildBoard(size) {
    const geometry = new THREE.BoxGeometry(size, DEFAULT_BOARD_THICKNESS, size);
    const material = new THREE.MeshStandardMaterial({ color: DEFAULT_BOARD_COLOR });
    this.boardMesh = new THREE.Mesh(geometry, material);
    this.boardMesh.position.set(0, BOARD_TOP_Y - DEFAULT_BOARD_THICKNESS / 2, 0);
    this.scene.add(this.boardMesh);
  }

  #buildNails(nails, { height, nailsVisible, nailThickness }) {
    const mesh = new THREE.InstancedMesh(this.nailGeometry, this.nailMaterial, nails.length);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const widthScale = nailThickness / (2 * SHAFT_RADIUS); // the nail model's shaft is 2 * SHAFT_RADIUS across
    const scale = new THREE.Vector3(widthScale, height, widthScale);
    const position = new THREE.Vector3();
    nails.forEach((nail, i) => {
      const world = to3D(nail, 0);
      position.set(world.x, world.y, world.z);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.visible = nailsVisible;
    this.nailMesh = mesh;
    this.scene.add(mesh);
  }

  #buildLayers(nails, settings) {
    const { nailCount, layerCount, leap, multiplier, height, weight, colors, nailThickness, showWrap } = settings;
    if (colors.length === 0) return;
    const threeColors = colors.map((c) => new THREE.Color(c));

    for (let layerIndex = 0; layerIndex < layerCount; layerIndex++) {
      const y = worldColorLayerHeight(layerIndex, layerCount, 0, height);
      const positions = [];
      const vertexColors = [];
      const leaving = new Map(); // nail index -> { directions, colorIndex } for the thread wrapped round it
      for (const { fromIndex, toIndex, colorIndex } of layerChords({ nailCount, multiplier, leap, layerIndex, colorCount: colors.length })) {
        const c = threeColors[colorIndex];
        // The thread wraps around its nails, so each chord is two parallel
        // strings a nail-thickness apart rather than one through the centers.
        for (const string of parallelStrings(nails[fromIndex], nails[toIndex], nailThickness)) {
          const from = to3D(string.from, y);
          const to = to3D(string.to, y);
          positions.push(from.x, from.y, from.z, to.x, to.y, to.z);
          vertexColors.push(c.r, c.g, c.b, c.r, c.g, c.b);
        }
        if (showWrap) {
          const a = nails[fromIndex];
          const b = nails[toIndex];
          const note = (index, dx, dy) => {
            if (!leaving.has(index)) leaving.set(index, { directions: [], colorIndex });
            leaving.get(index).directions.push({ x: dx, y: dy });
          };
          note(fromIndex, b.x - a.x, b.y - a.y);
          note(toIndex, a.x - b.x, a.y - b.y);
        }
      }
      // Where the thread turns round a nail: an arc of the nail's circle.
      for (const [index, { directions, colorIndex }] of leaving) {
        const arc = wrapArc(nails[index], nailThickness / 2, directions);
        const c = threeColors[colorIndex];
        for (let i = 0; i + 1 < arc.length; i++) {
          const from = to3D(arc[i], y);
          const to = to3D(arc[i + 1], y);
          positions.push(from.x, from.y, from.z, to.x, to.y, to.z);
          vertexColors.push(c.r, c.g, c.b, c.r, c.g, c.b);
        }
      }
      const line = assembleWeaveLineObject(positions, vertexColors, weight, this.lineResolution);
      if (!line) continue;
      this.scene.add(line);
      this.layerLines.push(line);
    }
  }

  #disposeContent() {
    if (this.boardMesh) {
      this.scene.remove(this.boardMesh);
      this.boardMesh.geometry.dispose();
      this.boardMesh.material.dispose();
      this.boardMesh = null;
    }
    if (this.nailMesh) {
      this.scene.remove(this.nailMesh);
      this.nailMesh.dispose(); // instance buffer only - geometry/material are shared
      this.nailMesh = null;
    }
    for (const line of this.layerLines) {
      this.scene.remove(line);
      line.geometry.dispose();
      line.material.dispose();
    }
    this.layerLines = [];
  }

  dispose() {
    this.#disposeContent();
    this.nailGeometry.dispose();
    this.nailMaterial.dispose();
  }
}
