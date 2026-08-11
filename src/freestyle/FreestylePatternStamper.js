import { Curve } from '../models/Curve.js';
import { flipPoints, translatePointsTo } from '../core/pointTransforms.js';

/**
 * Places copies of the currently-selected pattern onto a freestyle (gridless)
 * canvas. Same job as PatternStamper, minus the grid: there's no lattice to
 * snap to or auto-stamp across, so a pattern anchors exactly on the clicked
 * point and there's no "Auto" placement mode.
 */
export class FreestylePatternStamper {
  /**
   * @param {import('../core/Viewport.js').Viewport} viewport
   * @param {import('../state/CurveStore.js').CurveStore} curveStore
   * @param {import('../state/PatternStore.js').PatternStore} patternStore
   */
  constructor(viewport, curveStore, patternStore) {
    this.viewport = viewport;
    this.curveStore = curveStore;
    this.patternStore = patternStore;
  }

  /**
   * Stamps one copy of the selected pattern anchored exactly at the given
   * screen-space point. No-op if no pattern is selected. `flip` mirrors the
   * pattern the same way the hold-V/hold-H shortcuts preview it - whatever
   * was being previewed at the moment of the click is what gets placed.
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
    const points = translatePointsTo(flipPoints(pattern.points, flip), worldPos);
    this.curveStore.add(new Curve(points, pattern.colors.slice(), pattern.id, weight));
  }
}
