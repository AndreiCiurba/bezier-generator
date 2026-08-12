import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { to3D } from './axisMapping.js';
import { DEFAULT_NAIL_HEIGHT } from './nailHeight.js';
import { worldColorLayerHeight } from '../core/curveZLayers.js';
import { computeWeaveSegments } from '../core/weaveMath.js';

// Same margin-around-the-grid-bounding-box convention as App.js's own
// GRID_PADDING - the board shouldn't hug the outermost nails flush against
// its own edge.
const BOARD_PADDING = 50;
export const DEFAULT_BOARD_THICKNESS = 20;
export const DEFAULT_BOARD_COLOR = '#8a784e'; // matches --panel-bg-main's wood-ish tone
// The board's top surface sits at world Y = 0 - nails/curve layers live at
// Y >= 0, going up from the board.
export const BOARD_TOP_Y = 0;

// A nail's silhouette: a slim shaft topped with a noticeably wider, flatter
// head - reads as an actual nail (what the strings loop around sits at the
// head) rather than a uniform peg. Both radii and the shaft/head split are
// in the same local unit-height space `#buildNails` builds once and scales
// per instance, so "thicker head" stays proportionally correct at any nail
// height without a geometry rebuild.
const SHAFT_RADIUS = 2;
const HEAD_RADIUS = 5;
const SHAFT_FRACTION = 0.97; // the shaft is the bottom 97% of the nail; the head caps the top 3%
const NAIL_RADIAL_SEGMENTS = 10;
export const DEFAULT_NAIL_COLOR = '#cfcfcf'; // silvery, reads distinctly from the wood-toned board

// Screen-space pixel width for every woven string - native WebGL lines are
// capped at ~1px on most desktop GPU/driver combos, too thin to read as
// individual colored strands or show vertical layer separation from an
// oblique angle (the epic's own stated goal), hence the "fat line" addon
// (LineSegments2/LineMaterial) instead of plain THREE.LineSegments.
const CURVE_LINE_WIDTH = 2;

// Drawing Mode's in-progress selection guide - the app's own gold accent
// color (matches the 2D pages' on-axis live-preview-line/control-point
// highlight convention), so it reads unmistakably as "still being built,"
// not a committed string.
const SELECTION_GUIDE_COLOR = '#ffcc00';

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);
const _color = new THREE.Color();

/**
 * Builds the shared per-nail geometry once: a slim shaft (local Y in
 * [0, SHAFT_FRACTION]) merged with a wider, flatter head (local Y in
 * [SHAFT_FRACTION, 1]) into a single `BufferGeometry`, so every nail instance
 * still costs exactly one draw call (`InstancedMesh` needs one geometry, not
 * two meshes per nail).
 */
function buildNailGeometry() {
  const shaftHeight = SHAFT_FRACTION;
  const headHeight = 1 - SHAFT_FRACTION;

  const shaft = new THREE.CylinderGeometry(SHAFT_RADIUS, SHAFT_RADIUS, shaftHeight, NAIL_RADIAL_SEGMENTS);
  shaft.translate(0, shaftHeight / 2, 0); // base at local y=0

  const head = new THREE.CylinderGeometry(HEAD_RADIUS, HEAD_RADIUS, headHeight, NAIL_RADIAL_SEGMENTS);
  head.translate(0, shaftHeight + headHeight / 2, 0); // sits right on top of the shaft

  const merged = mergeGeometries([shaft, head]);
  shaft.dispose();
  head.dispose();
  return merged;
}

/**
 * Owns every `THREE.*` object in the scene and incrementally syncs it from
 * the design (`Grid`/`DeformableGrid` for the board/nails, `DesignModel` for
 * curves) - the only file that touches Three geometry/materials directly,
 * mirroring how `App.js` (wiring) stays separate from
 * `CanvasView`/`StringArtRenderer` (drawing) on the 2D page.
 *
 * String height model (confirmed spec): a string's height is driven by its
 * *color/weave-layer index within its own curve*, not by which curve it is -
 * with N colors, layer index `i` (0-based) sits at `(i+1)/N` of the current
 * nail height (see `core/curveZLayers.js`). Every curve sharing the same
 * color count therefore shares the same absolute per-layer heights, and
 * adding/removing *other* curves never shifts anything - height is baked
 * directly into each segment's own vertices (not a whole-object transform).
 */
export class SceneSync {
  /**
   * @param {import('three').Scene} scene
   * @param {import('../core/Grid.js').Grid} grid the base (undeformed) grid - its bounding box sizes/centers the board
   * @param {import('../core/DeformableGrid.js').DeformableGrid} deformation wraps `grid`; nails are read from its *current* (possibly deformed) positions, index-aligned with `grid.points` - reading through this now (even before any deformation UI exists - that's Slice 7) means deformation sync needs no further changes here later
   * @param {import('../core/DesignModel.js').DesignModel} design assembles ordered/visible curves from the same `CurveStore` this page owns
   */
  constructor(scene, grid, deformation, design) {
    this.scene = scene;
    this.design = design;
    this.nailHeight = DEFAULT_NAIL_HEIGHT;
    this.nailColor = DEFAULT_NAIL_COLOR;
    this.boardThickness = DEFAULT_BOARD_THICKNESS;
    this.boardColor = DEFAULT_BOARD_COLOR;
    this.boardMesh = null;
    this.nailMesh = null;
    this.curveLines = new Map(); // curve id -> LineSegments2
    this.lineResolution = new THREE.Vector2(1, 1);
    this.selectionGuide = null; // Drawing Mode's in-progress polyline, built lazily
    this.livePreview = null; // Drawing Mode's live woven-curve preview (>= 3 points), built lazily
    this._lastSelectionPoints = null;
    this._lastPreview = null;
    this.#adopt(grid, deformation);

    // The store instance itself never changes across a grid-size rebuild
    // (only `grid`/`deformation` are swapped - see `setGrid`), so this is a
    // one-time subscription, not something `#adopt` needs to redo.
    this.design.curveStore.onChange(() => this.#syncCurves());
    this.#syncCurves();
  }

  /**
   * Maps a 2D design-space point (+ optional world height) into this scene's
   * centered 3D world space - the one place that combines the origin shift
   * with `axisMapping#to3D`, so every other piece of scene content (nails,
   * curves, Drawing Mode's raycast hit) goes through the same transform.
   * @param {{x:number,y:number}} point2
   * @param {number} [height]
   * @returns {{x:number,y:number,z:number}}
   */
  toWorldPosition(point2, height = 0) {
    return to3D({ x: point2.x - this.origin.x, y: point2.y - this.origin.y }, height);
  }

  /** Inverse of `toWorldPosition` - drops height, recovers the 2D design-space point. */
  toDesignPosition(point3) {
    return { x: point3.x + this.origin.x, y: point3.z + this.origin.y };
  }

  /** No-op if `thickness` hasn't actually changed - avoids a pointless geometry rebuild. */
  setBoardThickness(thickness) {
    if (thickness === this.boardThickness) return;
    this.boardThickness = thickness;
    this.#rebuildBoardGeometry();
  }

  /** Color is a cheap material-only update - never rebuilds geometry. */
  setBoardColor(color) {
    this.boardColor = color;
    this.boardMesh.material.color.set(color);
  }

  /**
   * Every nail's unit-height cylinder is stretched to `height` via its own
   * per-instance matrix scale (see `#buildNails`), so changing this only
   * rewrites the instance-matrix buffer - one upload, no geometry rebuild,
   * regardless of grid size. Every curve's per-color-layer height is a
   * fraction *of* the nail height (see the class doc), so a nail-height
   * change does need every curve's geometry rebuilt (height is baked into
   * vertices, not a cheap whole-object offset) - see `#rebuildAllCurveObjects`.
   */
  setNailHeight(height) {
    if (height === this.nailHeight) return;
    this.nailHeight = height;
    this.#writeNailMatrices();
    this.#rebuildAllCurveObjects();
    if (this._lastSelectionPoints) this.setSelectionGuide(this._lastSelectionPoints);
    if (this._lastPreview) this.setLivePreview(this._lastPreview.points, this._lastPreview.colors);
  }

  /**
   * Swaps in a new base grid + deformation wrapper (e.g. after the "Grid
   * Size" control changes N) - board and nails are both fully rebuilt, since
   * both the footprint (bounding box) and the nail count change. Curves are
   * expected to already be cleared by the caller before this runs (grid-size
   * changes clear the design - see ThreeApp), so there's nothing curve-side
   * to reconcile here.
   * @param {import('../core/Grid.js').Grid} grid
   * @param {import('../core/DeformableGrid.js').DeformableGrid} deformation
   */
  setGrid(grid, deformation) {
    this.#disposeBoard();
    this.#disposeNails();
    this.#adopt(grid, deformation);
  }

  /** Re-reads `deformation.points` and rewrites nail positions - called after Puppet Warp (or any future deformation type) changes them. */
  syncNailPositions() {
    this.#writeNailMatrices();
  }

  /** Keeps every curve's (and the live preview's) fat-line width correct in screen-space pixels after a renderer resize. */
  setViewportSize(width, height) {
    this.lineResolution.set(width, height);
    for (const object of this.curveLines.values()) {
      object.material.resolution.set(width, height);
    }
    if (this.livePreview) this.livePreview.material.resolution.set(width, height);
  }

  /**
   * Drawing Mode's in-progress selection - a plain polyline through the
   * points placed so far, at nail-height (where the strings will actually
   * attach once committed). Cheap/rare enough (a handful of points, only
   * while actively drawing) that a plain, non-instanced `THREE.Line`
   * rebuilt on every change is simplest - no need for the fat-line addon
   * here, this is an editing aid, not exported/final geometry.
   * @param {{x:number,y:number}[]} points design-space points, in order
   */
  setSelectionGuide(points) {
    this._lastSelectionPoints = points;
    if (points.length < 2) {
      if (this.selectionGuide) this.selectionGuide.visible = false;
      return;
    }

    const vertices = points.map((point) => {
      const world = this.toWorldPosition(point, this.nailHeight);
      return new THREE.Vector3(world.x, world.y, world.z);
    });

    if (!this.selectionGuide) {
      const geometry = new THREE.BufferGeometry().setFromPoints(vertices);
      const material = new THREE.LineBasicMaterial({ color: SELECTION_GUIDE_COLOR });
      this.selectionGuide = new THREE.Line(geometry, material);
      this.scene.add(this.selectionGuide);
    } else {
      this.selectionGuide.geometry.dispose();
      this.selectionGuide.geometry = new THREE.BufferGeometry().setFromPoints(vertices);
    }
    this.selectionGuide.visible = true;
  }

  /** Clears the in-progress selection guide (e.g. after a commit/undo empties the selection back below 2 points). */
  clearSelectionGuide() {
    this.setSelectionGuide([]);
  }

  /**
   * Drawing Mode's live weave preview - what the in-progress selection would
   * actually look like as a woven curve if committed right now, using the
   * *current* live palette (mirrors the 2D page's
   * `StringArtRenderer.drawCurve(selection.points, palette.getAll(), ...)`
   * preview). Rebuilt on every call (points/colors, not a `Curve` instance -
   * there's nothing committed yet). No-op visually (hidden) below 3 points,
   * matching `SelectionStore#isReadyForCurve`.
   * @param {{x:number,y:number}[]} points
   * @param {{color:string,enabled:boolean}[]} colors
   */
  setLivePreview(points, colors) {
    this._lastPreview = { points, colors };
    if (this.livePreview) {
      this.scene.remove(this.livePreview);
      this.livePreview.geometry.dispose();
      this.livePreview.material.dispose();
      this.livePreview = null;
    }
    if (points.length < 3) return;

    const object = this.#buildWeaveObject(points, colors);
    if (!object) return;
    this.scene.add(object);
    this.livePreview = object;
  }

  /** Clears the live weave preview (e.g. once a selection is committed/cleared). */
  clearLivePreview() {
    this.setLivePreview([], []);
  }

  #adopt(grid, deformation) {
    this.grid = grid;
    this.deformation = deformation;

    const bbox = grid.boundingBox();
    this.boardWidth = bbox.width + BOARD_PADDING * 2;
    this.boardDepth = bbox.height + BOARD_PADDING * 2;
    // Every 2D design-space point (grid nails, curve points) gets shifted by
    // this origin before the axis remap, so the grid's own bounding-box
    // center lands at world X/Z = 0 - one consistent frame the board and
    // nails/curves all share, rather than each guessing their own offset.
    this.origin = { x: bbox.minX + bbox.width / 2, y: bbox.minY + bbox.height / 2 };

    this.#buildBoard();
    this.#buildNails();
  }

  #buildBoard() {
    const geometry = new THREE.BoxGeometry(this.boardWidth, this.boardThickness, this.boardDepth);
    const material = new THREE.MeshStandardMaterial({ color: this.boardColor });
    this.boardMesh = new THREE.Mesh(geometry, material);
    this.#positionBoard();
    this.scene.add(this.boardMesh);
  }

  #rebuildBoardGeometry() {
    this.boardMesh.geometry.dispose();
    this.boardMesh.geometry = new THREE.BoxGeometry(this.boardWidth, this.boardThickness, this.boardDepth);
    this.#positionBoard();
  }

  /** The box mesh is centered on its own origin, so it's shifted down by half its thickness to put its *top* surface at BOARD_TOP_Y. */
  #positionBoard() {
    this.boardMesh.position.set(0, BOARD_TOP_Y - this.boardThickness / 2, 0);
  }

  #disposeBoard() {
    this.scene.remove(this.boardMesh);
    this.boardMesh.geometry.dispose();
    this.boardMesh.material.dispose();
    this.boardMesh = null;
  }

  /**
   * One `InstancedMesh` for every nail - a single draw call regardless of
   * grid size, and cheap to reposition wholesale (Puppet Warp dragging every
   * nail at once, or a nail-height change) via one instance-matrix buffer
   * upload instead of per-object churn.
   *
   * The geometry spans local Y in [0, 1] (shaft base at 0, head top at 1) -
   * stretching it via a per-instance Y-scale keeps the base pinned at the
   * board surface for any nail height, so a nail-height change never needs a
   * geometry rebuild, only new matrices.
   */
  #buildNails() {
    const geometry = buildNailGeometry();
    const material = new THREE.MeshStandardMaterial({ color: this.nailColor });
    const count = this.deformation.points.length;
    this.nailMesh = new THREE.InstancedMesh(geometry, material, count);
    this.scene.add(this.nailMesh);
    this.#writeNailMatrices();
  }

  #writeNailMatrices() {
    const points = this.deformation.points;
    _quaternion.identity();
    _scale.set(1, this.nailHeight, 1);
    for (let i = 0; i < points.length; i++) {
      const world = this.toWorldPosition(points[i], 0);
      _position.set(world.x, world.y, world.z);
      _matrix.compose(_position, _quaternion, _scale);
      this.nailMesh.setMatrixAt(i, _matrix);
    }
    this.nailMesh.instanceMatrix.needsUpdate = true;
  }

  #disposeNails() {
    this.scene.remove(this.nailMesh);
    this.nailMesh.geometry.dispose();
    this.nailMesh.material.dispose();
    this.nailMesh = null;
  }

  /**
   * Reconciles `this.curveLines` against the current `CurveStore` contents:
   * builds a new `LineSegments2` for any curve id seen for the first time,
   * disposes/removes any id no longer in the store (undo/clear), then
   * applies current visibility to every surviving object. Unlike an earlier
   * per-curve-index height model, a curve's own height never depends on
   * *other* curves existing, so add/undo/clear never needs to touch
   * surviving curves' geometry - only the visibility flag, which is cheap.
   */
  #syncCurves() {
    const entries = this.design.curves; // full store order, not just visible ones
    const currentIds = new Set(entries.map((entry) => entry.id));

    for (const [id, object] of this.curveLines) {
      if (currentIds.has(id)) continue;
      this.scene.remove(object);
      object.geometry.dispose();
      object.material.dispose();
      this.curveLines.delete(id);
    }

    for (const entry of entries) {
      if (this.curveLines.has(entry.id)) continue;
      const object = this.#buildWeaveObject(entry.curve.points, entry.curve.colors);
      if (!object) continue; // a degenerate (<3-point) curve produces zero weave segments - nothing to show
      this.scene.add(object);
      this.curveLines.set(entry.id, object);
    }

    for (const entry of entries) {
      const object = this.curveLines.get(entry.id);
      if (object) object.visible = entry.visible;
    }
  }

  /** Disposes and rebuilds every curve's geometry against the *current* `this.nailHeight` - needed because per-color-layer height is baked into vertices (see the class doc), not a cheap whole-object offset. */
  #rebuildAllCurveObjects() {
    for (const [id, object] of this.curveLines) {
      this.scene.remove(object);
      object.geometry.dispose();
      object.material.dispose();
      this.curveLines.delete(id);
    }
    this.#syncCurves();
  }

  /**
   * Builds one `LineSegments2` for a curve's (or the in-progress selection's)
   * full weave - every enabled color-layer's segments, via the shared, pure
   * `computeWeaveSegments` (no new weave math, identical per-triplet geometry
   * to the 2D page). Each color-layer's segments get their own world Y,
   * `worldColorLayerHeight(layerIndex, colors.length, 0, this.nailHeight)` -
   * baked directly into the vertex data, not a whole-object transform, so
   * different layers of the *same* curve can sit at different heights.
   *
   * Uses the "fat line" addon (`LineSegments2`/`LineMaterial`) instead of
   * native `THREE.LineSegments`, whose width is capped at ~1px on most
   * desktop GPU/driver combos - too thin to read as individual colored
   * strands or to show vertical layer separation from an oblique angle.
   * @param {{x:number,y:number}[]} points
   * @param {{color:string,enabled:boolean}[]} colors
   * @returns {LineSegments2 | null} null if there are fewer than 3 points (no weave segments to draw)
   */
  #buildWeaveObject(points, colors) {
    if (points.length < 3) return null;
    const colorCount = colors.length;

    const positions = [];
    const vertexColors = [];
    for (let i = 0; i < points.length - 2; i++) {
      const [p1, p2, p3] = [points[i], points[i + 1], points[i + 2]];
      colors.forEach((layer, layerIndex) => {
        if (!layer.enabled) return;
        const y = worldColorLayerHeight(layerIndex, colorCount, 0, this.nailHeight);
        _color.set(layer.color);
        for (const { from, to } of computeWeaveSegments(p1, p2, p3, layerIndex, colorCount)) {
          const worldFrom = this.toWorldPosition(from, y);
          const worldTo = this.toWorldPosition(to, y);
          positions.push(worldFrom.x, worldFrom.y, worldFrom.z, worldTo.x, worldTo.y, worldTo.z);
          vertexColors.push(_color.r, _color.g, _color.b, _color.r, _color.g, _color.b);
        }
      });
    }
    if (positions.length === 0) return null;

    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(positions);
    geometry.setColors(vertexColors);

    const material = new LineMaterial({
      vertexColors: true,
      linewidth: CURVE_LINE_WIDTH,
      resolution: this.lineResolution,
    });

    const object = new LineSegments2(geometry, material);
    object.computeLineDistances();
    return object;
  }

  /** Disposes every owned geometry/material - called when the page unloads or the scene is torn down. */
  dispose() {
    this.#disposeBoard();
    this.#disposeNails();
    for (const object of this.curveLines.values()) {
      object.geometry.dispose();
      object.material.dispose();
    }
    this.curveLines.clear();
    if (this.selectionGuide) {
      this.selectionGuide.geometry.dispose();
      this.selectionGuide.material.dispose();
      this.selectionGuide = null;
    }
    if (this.livePreview) {
      this.livePreview.geometry.dispose();
      this.livePreview.material.dispose();
      this.livePreview = null;
    }
  }
}
