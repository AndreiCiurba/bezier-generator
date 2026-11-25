import * as THREE from 'three';
import { to3D } from '../three-page/axisMapping.js';
import {
  DEFAULT_BOARD_THICKNESS, DEFAULT_BOARD_COLOR, BOARD_TOP_Y, DEFAULT_NAIL_COLOR, SHAFT_RADIUS, HEAD_RADIUS, buildNailGeometry,
} from '../three-page/SceneSync.js';
import { assembleWeaveLineObject } from '../three-page/weaveLineBuilder.js';
import { worldColorLayerHeight } from '../core/curveZLayers.js';
import { ellipseNailPositions, stackChords, wrapArc } from '../core/cardioidWeave.js';
import { threadGeometry, connectionStrands, mmToWorld, nailHasHead } from '../core/threadWrap.js';

const BOARD_MARGIN = 1.3; // board half-extent as a multiple of the circle radius

/**
 * Owns every Three.js object on the Cardioid board: a flat square board, one
 * standing nail per circle nail, and one `LineSegments2` per layer (holding
 * every run of its stack, each `runGapMm` above the one before), built
 * with the same `assembleWeaveLineObject` the grid and Arrange pages use.
 * Thread and nails are drawn at their real size (10 world units = 1 mm, see
 * `core/threadWrap.js`), exactly like the Arrange board. Everything is
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
    this.headlessNailGeometry = buildNailGeometry(SHAFT_RADIUS, SHAFT_RADIUS); // 3 mm and wider: plain rods
    this.nailMaterial = new THREE.MeshStandardMaterial({ color: DEFAULT_NAIL_COLOR });
  }

  /** Side length of the board for a given circle radius (and ellipse stretch) - also what the camera frames. */
  static boardSizeFor(radius, stretch = 1) {
    return radius * Math.max(1, stretch) * 2 * BOARD_MARGIN;
  }

  setViewportSize(width, height) {
    this.lineResolution.set(width, height);
    for (const line of this.layerLines) line.material.resolution.set(width, height);
  }

  /**
   * @param {{
   *   nailCount:number, layerCount:number, leap:number, multiplier:number, radius:number,
   *   height:number,
   *   stretch:number, direction:'cw'|'ccw', runGapMm:number,
   *   runs: import('../models/cardioidRun.js').CardioidRun[], nailsVisible:boolean, showWrap:boolean,
   *   thread: {threadWidthMm:number, nailDiameterMm:number, technique:string}
   * }} settings
   */
  rebuild(settings) {
    this.#disposeContent();
    this.#buildBoard(CardioidSceneSync.boardSizeFor(settings.radius, settings.stretch));

    const nails = ellipseNailPositions(settings.nailCount, settings.radius, { stretch: settings.stretch, direction: settings.direction });
    const thread = threadGeometry(settings.thread);
    this.#buildNails(nails, settings, thread);
    this.#buildLayers(nails, settings, thread);
  }

  #buildBoard(size) {
    const geometry = new THREE.BoxGeometry(size, DEFAULT_BOARD_THICKNESS, size);
    const material = new THREE.MeshStandardMaterial({ color: DEFAULT_BOARD_COLOR });
    this.boardMesh = new THREE.Mesh(geometry, material);
    this.boardMesh.position.set(0, BOARD_TOP_Y - DEFAULT_BOARD_THICKNESS / 2, 0);
    this.scene.add(this.boardMesh);
  }

  #buildNails(nails, { height, nailsVisible, thread: threadSettings }, thread) {
    const geometry = nailHasHead(threadSettings.nailDiameterMm) ? this.nailGeometry : this.headlessNailGeometry;
    const mesh = new THREE.InstancedMesh(geometry, this.nailMaterial, nails.length);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const widthScale = thread.nailRadius / SHAFT_RADIUS; // the nail model's shaft is SHAFT_RADIUS round
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

  #buildLayers(nails, settings, thread) {
    const { nailCount, layerCount, leap, multiplier, height, runs, runGapMm, showWrap } = settings;
    const runGap = mmToWorld(runGapMm);
    const byLayer = Array.from({ length: layerCount }, () => []);
    for (const chord of stackChords({ nailCount, layerCount, leap, multiplier, runs })) byLayer[chord.layerIndex].push(chord);
    const color = new THREE.Color();

    byLayer.forEach((chords, layerIndex) => {
      const layerY = worldColorLayerHeight(layerIndex, layerCount, 0, height);
      const positions = [];
      const vertexColors = [];
      const push = (a, b, y, hex) => {
        const from = to3D(a, y);
        const to = to3D(b, y);
        color.set(hex);
        positions.push(from.x, from.y, from.z, to.x, to.y, to.z);
        vertexColors.push(color.r, color.g, color.b, color.r, color.g, color.b);
      };
      // Per run of the stack: nail index -> { directions, color } for the thread wrapped round it.
      const leaving = new Map();
      for (const { fromIndex, toIndex, color: hex, stackIndex, single } of chords) {
        const y = layerY + stackIndex * runGap;
        // The thread wraps around its nails, so each chord is two strands -
        // crossing (8) or parallel (O) - rather than one through the centers;
        // the last chord of a run is the thread's end, strung one way only.
        for (const string of connectionStrands(nails[fromIndex], nails[toIndex], thread.wrapRadius, thread.technique, single)) {
          push(string.from, string.to, y, hex);
        }
        if (showWrap) {
          const a = nails[fromIndex];
          const b = nails[toIndex];
          const note = (index, dx, dy) => {
            const key = `${stackIndex}:${index}`;
            if (!leaving.has(key)) leaving.set(key, { index, y, hex, directions: [] });
            leaving.get(key).directions.push({ x: dx, y: dy });
          };
          note(fromIndex, b.x - a.x, b.y - a.y);
          note(toIndex, a.x - b.x, a.y - b.y);
        }
      }
      // Where the thread turns round a nail: an arc of the nail's circle.
      for (const { index, y, hex, directions } of leaving.values()) {
        const arc = wrapArc(nails[index], thread.wrapRadius, directions);
        for (let i = 0; i + 1 < arc.length; i++) push(arc[i], arc[i + 1], y, hex);
      }
      const line = assembleWeaveLineObject(positions, vertexColors, 1, this.lineResolution, 1, thread.lineWidth);
      if (!line) return;
      this.scene.add(line);
      this.layerLines.push(line);
    });
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
    this.headlessNailGeometry.dispose();
    this.nailMaterial.dispose();
  }
}
