import { strokeWeightForColorCount } from '../core/strokeWeight.js';

// Curve ids are purely internal bookkeeping (never exported/imported/
// persisted like Pattern ids are), so a plain local counter is enough - same
// reasoning as Pin's `generatePinId` in DeformableGrid.js - no need for
// utils/id.js's real (CDN-sourced) uuid here.
let nextCurveId = 0;
function generateCurveId() {
  return `curve-${nextCurveId++}`;
}

/**
 * One woven string-art curve sitting on the canvas: an ordered path of nails plus
 * the stroke colors used to weave it. Produced either by finishing a manual
 * selection (see SelectionStore) or by stamping a saved Pattern.
 */
export class Curve {
  /**
   * @param {import('../core/Point.js').Point[]} points
   * @param {{color: string, enabled: boolean}[]} colors
   * @param {string|null} patternId set when this curve came from stamping a pattern
   * @param {number|null} weight explicit stroke weight to lock this curve to
   *   (freestyle's manual "Stroke Weight" setting - see StrokeWeightUI) -
   *   `null` (the grid tool's only behavior, unchanged) falls back to the
   *   live `strokeWeightForColorCount(colors.length)` derivation instead -
   *   see `renderWeight`.
   * @param {boolean} visible whether this curve currently renders/exports -
   *   see CurveStore#setVisible, the only place this should ever be flipped
   *   after construction (so listeners get notified). Defaults to visible,
   *   so no existing call site needs to change.
   * @param {{cellCorners: import('../core/Point.js').Point[], n: number, leap: number, cellId: string}|null} closedWeave
   *   set when this curve is a Weave-feature closed-polygon leap weave
   *   rather than an ordinary hand-drawn/pattern-stamped open curve - see
   *   `src/core/closedWeaveMath.js`. `points` is still populated (with
   *   `cellCorners`, so every existing "just read `curve.points`" consumer
   *   keeps working, e.g. `CanvasView`'s selection guide or a JSON export),
   *   but rendering/export code that needs the *actual* weave geometry
   *   (`StringArtRenderer`, `ExportRenderer`, `SceneSync`, `nailPositions.js`)
   *   must branch on this field and call the `closedWeaveMath.js` functions
   *   instead of the ordinary triplet-based ones. `cellId` is a stable key
   *   for "which cell is this", derived from the cell's own corner
   *   positions - used the same way `patternId` is used today, to answer
   *   "does a weave curve already exist for this cell" (see
   *   `CurveStore#hasCurveForPattern`'s Weave-feature equivalent).
   */
  constructor(points, colors, patternId = null, weight = null, visible = true, closedWeave = null) {
    this.id = generateCurveId();
    this.points = points;
    this.colors = colors;
    this.patternId = patternId;
    this.weight = weight;
    this.visible = visible;
    this.closedWeave = closedWeave;
    // Once true, live edits to the palette stop repainting this curve - it's
    // "locked in". Curves stamped from the currently-selected pattern start
    // false so they pick up one live recolor before locking.
    this.previouslyDrawn = patternId === null;
    // 0-1 - the Weave menu's "dim everything except what I'm working on"
    // live-selection view (see WEAVE_DIMMED_ALPHA in both App.js and
    // ThreeApp.js). Set every frame/refresh by App.js's draw loop and
    // ThreeApp.js's #refreshLiveWeaveCurves while a Weave live selection is
    // active; 1 (fully opaque) the rest of the time, including for every
    // curve that was never touched by Weave at all. On the 2D page this
    // value only decides *whether* a curve draws onto App.js's offscreen
    // `dimBuffer` instead of the main canvas - the actual fade (plus a blur
    // and desaturation) happens once, for the whole buffer, at composite
    // time, not per curve (see App.js's own doc for why). The 3D page has no
    // such buffer to composite through, so `renderAlpha` there is applied
    // directly as the curve's `LineMaterial.opacity`.
    this.renderAlpha = 1;
  }

  belongsToPattern(patternId) {
    return this.patternId !== null && this.patternId === patternId;
  }

  /** Whether this curve is a Weave-feature closed-polygon leap weave (see the constructor doc) rather than an ordinary curve. */
  get isClosedWeave() {
    return this.closedWeave !== null;
  }

  belongsToCell(cellId) {
    return this.closedWeave !== null && this.closedWeave.cellId === cellId;
  }

  /**
   * The stroke weight to actually render this curve with: its own explicit
   * override if it has one, otherwise derived live from its own color count
   * (the grid tool's only behavior, and freestyle's before manual weight
   * selection existed) - never the *current* palette/setting, so a later
   * change never alters how an already-drawn curve renders.
   */
  get renderWeight() {
    return this.weight ?? strokeWeightForColorCount(this.colors.length);
  }

  /**
   * Overwrite this curve's colors with a snapshot of `strokes`. Doesn't touch
   * `previouslyDrawn` itself - the render loop is what decides a curve has
   * now been drawn at least once, regardless of whether this ran.
   */
  recolor(strokes) {
    this.colors = strokes.map((c) => ({ color: c.color, enabled: c.enabled }));
  }
}

/**
 * Whether `curve` should keep reflecting live palette/stroke-weight/layer-
 * enable edits made *after* it was stamped, rather than freezing the moment
 * it was placed - true only while the pattern it came from remains both
 * selected/armed (`patterns.isInUse`) *and* in Auto placement mode. A plain
 * per-click Manual-mode stamp (or a hand-drawn curve) always locks in its
 * appearance immediately, same as before - this only applies to the "stamp
 * everywhere at once" Auto workflow, and only for as long as that same
 * pattern stays the active selection (deselecting, clearing, or switching
 * back to Manual mode freezes every curve exactly as it last looked).
 *
 * A plain function taking `patterns` rather than a `Curve` method, so this
 * file doesn't have to import `PatternStore` just for its shape - matches
 * `belongsToPattern`'s own "take the id, not the whole store" convention,
 * one level up.
 * @param {Curve} curve
 * @param {import('../state/PatternStore.js').PatternStore} patterns
 * @returns {boolean}
 */
export function isLiveAutoPatternCurve(curve, patterns) {
  return curve.belongsToPattern(patterns.selectedPatternId) && patterns.isInUse && patterns.placementMode === 'auto';
}
