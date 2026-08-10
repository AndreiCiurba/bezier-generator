import { Curve } from '../models/Curve.js';

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
   * screen-space point. No-op if no pattern is selected.
   * @param {{x:number,y:number}} screenPos
   */
  stampAtScreenPoint(screenPos) {
    const pattern = this.patternStore.selectedPattern;
    if (!pattern) return;

    const worldPos = this.viewport.toWorld(screenPos.x, screenPos.y);
    this.curveStore.add(new Curve(pattern.translatedTo(worldPos), pattern.colors.slice(), pattern.id));
  }
}
