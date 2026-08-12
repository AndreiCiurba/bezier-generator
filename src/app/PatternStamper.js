import { Curve } from '../models/Curve.js';
import { flipPoints, translatePointsTo } from '../core/pointTransforms.js';

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
   * Stamps one copy of the selected pattern anchored at the nail nearest the
   * given screen-space point. No-op if no pattern is selected or no nail is
   * close enough to anchor on. `flip` mirrors the pattern the same way the
   * hold-V/hold-H shortcuts preview it - whatever was being previewed at the
   * moment of the click is what gets placed.
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

    const points = translatePointsTo(flipPoints(pattern.points, flip), anchor);
    this.curveStore.add(new Curve(points, pattern.colors.slice(), pattern.id, weight));
  }

  /**
   * Stamps a copy of the selected pattern anchored at every grid nail at
   * once ("Auto" placement mode). No-op if this pattern has already been
   * stamped throughout the grid.
   * @param {number|null} [weight] see `stampAtScreenPoint`
   */
  stampThroughoutGrid(weight = null) {
    const pattern = this.patternStore.selectedPattern;
    if (!pattern) return;
    if (this.curveStore.hasCurveForPattern(pattern.id)) return;

    for (const anchor of this.grid.points) {
      this.curveStore.add(new Curve(pattern.translatedTo(anchor), pattern.colors, pattern.id, weight));
    }
  }
}
