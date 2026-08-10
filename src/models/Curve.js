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
   */
  constructor(points, colors, patternId = null) {
    this.points = points;
    this.colors = colors;
    this.patternId = patternId;
    // Once true, live edits to the palette stop repainting this curve - it's
    // "locked in". Curves stamped from the currently-selected pattern start
    // false so they pick up one live recolor before locking.
    this.previouslyDrawn = patternId === null;
  }

  belongsToPattern(patternId) {
    return this.patternId !== null && this.patternId === patternId;
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
