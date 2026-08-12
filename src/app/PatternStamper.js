import { Curve } from '../models/Curve.js';
import { flipPoints, translatePointsTo } from '../core/pointTransforms.js';

// How close a translated pattern point has to land to a real nail to count
// as "connected" to it - the same tolerance every other "click near a nail"
// snap in the app already uses (App.js/ThreeApp's own NEAREST_NAIL_RADIUS).
// A pattern's points were originally captured by clicking real nails, so on
// the *same* grid a rigid translate already lands within a fraction of a
// pixel of a nail; this only starts rejecting points once the grid the
// pattern is being applied to has genuinely moved that point away from any
// nail - a resized grid whose edge cuts the pattern off, or a deformed one
// whose nails no longer sit where the undeformed lattice math predicts.
const NAIL_SNAP_RADIUS = 10;

/**
 * Places copies of the currently-selected pattern onto the grid.
 *
 * Fixes a real bug from the original `renderPattern`: it converted the click
 * from screen space to world space internally, but its caller in main.js had
 * *already* done that conversion before calling it - so a pattern stamp's
 * position was double-corrected for pan/zoom, landing in the wrong place
 * anytime the canvas wasn't at its default pan/zoom. `stampAtScreenPoint` now
 * does the one, single, canonical conversion.
 *
 * Also fixes `renderPattern`'s nearest-nail lookup, which took the *first*
 * grid point found within 10px rather than the truly nearest one, and threw
 * if none qualified - see Grid#findNearestPoint.
 *
 * A pattern's own points are plain rigid geometry (see Pattern.js) - stamping
 * it is a rigid translate (+ optional flip), not a re-derivation against
 * whatever grid it's stamped onto. That's exactly right when the target grid
 * is identical to the one the pattern was drawn on, but breaks down the
 * moment it isn't - a resized grid (fewer/more nails, same spacing, so a
 * translated point can simply fall off the edge) or a *deformed* one (nails
 * no longer sit at their undeformed lattice positions at all). `#snapToNails`
 * is the fix for both: every translated point is re-resolved to the nearest
 * *actual* current nail (live/deformed, via `grid.findNearestPoint`) rather
 * than trusted as-is, and the whole stamp is dropped - not drawn half-
 * connected to nothing - the moment any single point has no nail within
 * reach.
 */
export class PatternStamper {
  /**
   * @param {import('../core/Grid.js').Grid} grid
   * @param {import('../core/Viewport.js').Viewport} viewport
   * @param {import('../state/CurveStore.js').CurveStore} curveStore
   * @param {import('../state/PatternStore.js').PatternStore} patternStore
   */
  constructor(grid, viewport, curveStore, patternStore) {
    this.grid = grid;
    this.viewport = viewport;
    this.curveStore = curveStore;
    this.patternStore = patternStore;
  }

  /**
   * Repoints this stamper at a different grid (e.g. the 3D page's "Grid
   * Size" control replacing its `DeformableGrid` wholesale) - without this,
   * a stamper constructed once against the original grid would keep
   * anchoring/snapping against that stale instance forever, silently
   * ignoring every later resize.
   * @param {import('../core/Grid.js').Grid} grid
   */
  setGrid(grid) {
    this.grid = grid;
  }

  /**
   * Stamps one copy of the selected pattern anchored at the nail nearest the
   * given screen-space point. No-op if no pattern is selected, no nail is
   * close enough to anchor on, or the translated shape doesn't fully connect
   * to real nails (see class doc). `flip` mirrors the pattern the same way
   * the hold-V/hold-H shortcuts preview it - whatever was being previewed at
   * the moment of the click is what gets placed.
   * @param {{x:number,y:number}} screenPos
   * @param {{horizontal?: boolean, vertical?: boolean}} [flip]
   * @param {number|null} [weight] the current "Stroke Weight" setting (see
   *   StrokeWeightUI) to lock this stamp to - `null` falls back to the
   *   color-count-derived default (`Curve#renderWeight`).
   */
  stampAtScreenPoint(screenPos, flip, weight = null) {
    const pattern = this.patternStore.selectedPattern;
    if (!pattern) return;

    const worldPos = this.viewport.toWorld(screenPos.x, screenPos.y);
    const anchor = this.grid.findNearestPoint(worldPos);
    if (!anchor) return;

    const translated = translatePointsTo(flipPoints(pattern.points, flip), anchor);
    const points = this.#snapToNails(translated);
    if (!points) return;
    this.curveStore.add(new Curve(points, pattern.colors.slice(), pattern.id, weight));
  }

  /**
   * Stamps a copy of the selected pattern anchored at every grid nail at
   * once ("Auto" placement mode) - skipping any anchor whose translated
   * shape doesn't fully connect to real nails (runs off the edge of the
   * *current* grid, or doesn't line up under deformation - see class doc),
   * rather than drawing a copy that floats free of the board. No-op if this
   * pattern has already been stamped throughout the grid.
   * @param {number|null} [weight] see `stampAtScreenPoint`
   */
  stampThroughoutGrid(weight = null) {
    const pattern = this.patternStore.selectedPattern;
    if (!pattern) return;
    if (this.curveStore.hasCurveForPattern(pattern.id)) return;

    for (const anchor of this.grid.points) {
      const points = this.#snapToNails(pattern.translatedTo(anchor));
      if (!points) continue;
      this.curveStore.add(new Curve(points, pattern.colors, pattern.id, weight));
    }
  }

  /**
   * Resolves every translated pattern point to the nearest real nail in the
   * *current* grid (its live, possibly-deformed positions), returning copies
   * so the new curve never aliases the grid's own live `Point` objects (they
   * must stay frozen once a curve is committed, same as manually-selected
   * curve points already are). Returns `null` - not a partial array - the
   * instant any single point has no nail within `NAIL_SNAP_RADIUS`, since a
   * pattern that only partly fits shouldn't be drawn as a shape connected to
   * nothing for its missing points.
   * @param {{x:number,y:number}[]} points
   * @returns {import('../core/Point.js').Point[] | null}
   */
  #snapToNails(points) {
    const snapped = [];
    for (const point of points) {
      const nail = this.grid.findNearestPoint(point, NAIL_SNAP_RADIUS);
      if (!nail) return null;
      snapped.push(nail.copy());
    }
    return snapped;
  }
}
