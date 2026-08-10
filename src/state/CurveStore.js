/**
 * All curves committed to the canvas so far.
 */
export class CurveStore {
  #curves = [];

  get curves() {
    return this.#curves;
  }

  get count() {
    return this.#curves.length;
  }

  add(curve) {
    this.#curves.push(curve);
  }

  /** Removes the most recently added curve, if any. */
  undo() {
    return this.#curves.pop();
  }

  clear() {
    this.#curves.length = 0;
  }

  curvesForPattern(patternId) {
    return this.#curves.filter((c) => c.belongsToPattern(patternId));
  }

  hasCurveForPattern(patternId) {
    return this.#curves.some((c) => c.belongsToPattern(patternId));
  }
}
