import * as THREE from 'three';
import { to3D } from '../three-page/axisMapping.js';
import {
  DEFAULT_BOARD_THICKNESS, DEFAULT_BOARD_COLOR, BOARD_TOP_Y, DEFAULT_NAIL_COLOR, SHAFT_RADIUS, HEAD_RADIUS, HEAD_THICKNESS_RATIO, buildNailParts,
} from '../three-page/SceneSync.js';
import { assembleWeaveLineObject } from '../three-page/weaveLineBuilder.js';
import { worldColorLayerHeight } from '../core/curveZLayers.js';
import { circleNailPositions, circlePointAt, chordDrawAmount, nailSeating, layerChords, parallelStrings, wrapArc } from '../core/cardioidWeave.js';

const BOARD_MARGIN = 1.3; // board half-extent as a multiple of the circle radius
const UNDRIVEN_NAIL_LIFT = 0.55; // how much of its height a nail still stands proud by before the first hammer blow

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
    this.nailMeshes = [];
    this.boardMesh = null;
    this.nailParts = buildNailParts(SHAFT_RADIUS, HEAD_RADIUS);
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
   *   colors: string[], nailsVisible:boolean, nailThickness:number, showWrap:boolean,
   *   drawProgress?:number, drawMode?:'sequential'|'parallel', nailProgress?:number, layerColors?:string[],
   *   boardVisible?:boolean, boardColor?:string, highlight?:{chord:number, color:string, weight:number}|null
   * }} settings `colors` are the enabled palette colors, one per color group.
   *   The optional ones are only ever set by the reel timeline (see
   *   `CardioidReel.js`); the page itself leaves them out and gets the whole
   *   weave on the default board, as before:
   *   - `drawProgress`/`drawMode`: how much of the weave is strung yet (see
   *     `chordDrawAmount`); the string in progress is drawn part-way across.
   *   - `nailProgress`: how many of the nails have been hammered in yet (see
   *     `nailSeating`); the one being driven stands proud of the rest.
   *   - `layerColors`: one color per layer, replacing the per-arc `colors`
   *     split for that layer - a gradient up the stack.
   *   - `highlight`: one string of the bottom layer redrawn bold in its own
   *     color - from nail `chord` to nail `multiplier * chord` - for a reel
   *     explaining the rule.
   *   - `multiplier`/`leap` may be fractional mid-animation, so chord ends
   *     are looked up with `circlePointAt` rather than indexed out of the
   *     nail list.
   */
  rebuild(settings) {
    this.#disposeContent();
    if (settings.boardVisible ?? true) {
      this.#buildBoard(CardioidSceneSync.boardSizeFor(settings.radius), settings.boardColor ?? DEFAULT_BOARD_COLOR);
    }

    const nails = circleNailPositions(settings.nailCount, settings.radius);
    this.#buildNails(nails, settings);
    this.#buildLayers(nails, settings);
    this.#buildHighlight(settings);
  }

  #buildHighlight({ highlight, nailCount, multiplier, radius, height, layerCount, weight }) {
    if (!highlight || highlight.chord <= 0) return;
    const from = to3D(circlePointAt(highlight.chord, nailCount, radius), 0);
    const to = to3D(circlePointAt(highlight.chord * multiplier, nailCount, radius), 0);
    // Just above the bottom layer it belongs to, so it is never hidden inside it.
    const y = worldColorLayerHeight(0, layerCount, 0, height) + height * 0.01;
    const c = new THREE.Color(highlight.color);
    const line = assembleWeaveLineObject([from.x, y, from.z, to.x, y, to.z], [c.r, c.g, c.b, c.r, c.g, c.b], weight * highlight.weight, this.lineResolution);
    line.material.depthTest = false; // drawn over the weave: it is the thing being pointed at
    line.renderOrder = 10;
    this.scene.add(line);
    this.layerLines.push(line);
  }

  #buildBoard(size, color) {
    const geometry = new THREE.BoxGeometry(size, DEFAULT_BOARD_THICKNESS, size);
    const material = new THREE.MeshStandardMaterial({ color });
    this.boardMesh = new THREE.Mesh(geometry, material);
    this.boardMesh.position.set(0, BOARD_TOP_Y - DEFAULT_BOARD_THICKNESS / 2, 0);
    this.scene.add(this.boardMesh);
  }

  #buildNails(nails, { height, nailsVisible, nailThickness, nailProgress = 1 }) {
    const shaft = new THREE.InstancedMesh(this.nailParts.shaft, this.nailMaterial, nails.length);
    const head = new THREE.InstancedMesh(this.nailParts.head, this.nailMaterial, nails.length);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const widthScale = nailThickness / (2 * SHAFT_RADIUS); // the nail model's shaft is 2 * SHAFT_RADIUS across
    // The head is a thin disc of fixed thickness, however tall the nail is.
    const thick = Math.min(HEAD_RADIUS * widthScale * HEAD_THICKNESS_RATIO, height * 0.5);
    const shaftScale = new THREE.Vector3(widthScale, height - thick, widthScale);
    const headScale = new THREE.Vector3(widthScale, thick, widthScale);
    const nothing = new THREE.Vector3(0, 0, 0); // an instanced mesh has no per-instance "hidden"; zero size does the job
    const position = new THREE.Vector3();
    nails.forEach((nail, i) => {
      // A nail being hammered in starts with most of its length still above
      // where it will end up; one not placed yet is not there at all.
      const seating = nailSeating({ nailIndex: i, nailCount: nails.length, progress: nailProgress });
      const world = to3D(nail, (1 - seating) * height * UNDRIVEN_NAIL_LIFT);
      position.set(world.x, world.y, world.z);
      matrix.compose(position, quaternion, seating === 0 ? nothing : shaftScale);
      shaft.setMatrixAt(i, matrix);
      position.set(world.x, world.y + height - thick / 2, world.z);
      matrix.compose(position, quaternion, seating === 0 ? nothing : headScale);
      head.setMatrixAt(i, matrix);
    });
    for (const mesh of [shaft, head]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.visible = nailsVisible;
      this.scene.add(mesh);
    }
    this.nailMeshes = [shaft, head];
  }

  #buildLayers(nails, settings) {
    const { nailCount, layerCount, leap, multiplier, radius, height, weight, colors, nailThickness, showWrap } = settings;
    const { drawProgress = 1, drawMode = 'sequential', layerColors = null } = settings;
    if (colors.length === 0) return;
    const threeColors = colors.map((c) => new THREE.Color(c));
    // Whole indices are the real nails; a fractional one (reel only) is a point between two.
    const pointAt = (index) => (Number.isInteger(index) ? nails[index] : circlePointAt(index, nailCount, radius));

    for (let layerIndex = 0; layerIndex < layerCount; layerIndex++) {
      const y = worldColorLayerHeight(layerIndex, layerCount, 0, height);
      const positions = [];
      const vertexColors = [];
      const leaving = new Map(); // nail index -> { directions, colorIndex } for the thread wrapped round it
      const layerColor = layerColors ? new THREE.Color(layerColors[layerIndex]) : null;
      const chords = layerChords({ nailCount, multiplier, leap, layerIndex, colorCount: colors.length });
      const amount = chordDrawAmount({ layerIndex, layerCount, chordsPerLayer: chords.length, progress: drawProgress, mode: drawMode });
      const whole = Math.floor(amount);
      const visible = chords.slice(0, Math.ceil(amount));
      visible.forEach(({ fromIndex, toIndex, colorIndex }, chordIndex) => {
        const c = layerColor ?? threeColors[colorIndex];
        // The last chord may still be on its way across: it ends part-way
        // between its two nails rather than at the second one.
        const pulled = chordIndex < whole ? 1 : amount - whole;
        const start = pointAt(fromIndex);
        const full = pointAt(toIndex);
        const end = pulled === 1 ? full : { x: start.x + (full.x - start.x) * pulled, y: start.y + (full.y - start.y) * pulled };
        // The thread wraps around its nails, so each chord is two parallel
        // strings a nail-thickness apart rather than one through the centers.
        for (const string of parallelStrings(start, end, nailThickness)) {
          const from = to3D(string.from, y);
          const to = to3D(string.to, y);
          positions.push(from.x, from.y, from.z, to.x, to.y, to.z);
          vertexColors.push(c.r, c.g, c.b, c.r, c.g, c.b);
        }
        if (showWrap) {
          const a = pointAt(fromIndex);
          const b = pointAt(toIndex);
          const note = (index, dx, dy) => {
            if (!leaving.has(index)) leaving.set(index, { directions: [], colorIndex });
            leaving.get(index).directions.push({ x: dx, y: dy });
          };
          note(fromIndex, b.x - a.x, b.y - a.y);
          if (pulled === 1) note(toIndex, a.x - b.x, a.y - b.y); // nothing wraps the far nail until the string reaches it
        }
      });
      // Where the thread turns round a nail: an arc of the nail's circle.
      for (const [index, { directions, colorIndex }] of leaving) {
        const arc = wrapArc(pointAt(index), nailThickness / 2, directions);
        const c = layerColor ?? threeColors[colorIndex];
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
    for (const mesh of this.nailMeshes) {
      this.scene.remove(mesh);
      mesh.dispose(); // instance buffer only - geometry/material are shared
    }
    this.nailMeshes = [];
    for (const line of this.layerLines) {
      this.scene.remove(line);
      line.geometry.dispose();
      line.material.dispose();
    }
    this.layerLines = [];
  }

  dispose() {
    this.#disposeContent();
    this.nailParts.shaft.dispose();
    this.nailParts.head.dispose();
    this.nailMaterial.dispose();
  }
}
