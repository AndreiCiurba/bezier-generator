/**
 * All curves committed to the canvas so far.
 */
export class CurveStore {
  #curves = [];
  #listeners = new Set();

  get curves() {
    return this.#curves;
  }

  get count() {
    return this.#curves.length;
  }

  /** Curves whose `visible` flag is currently true, in the same store order. */
  get visibleCurves() {
    return this.#curves.filter((c) => c.visible);
  }

  add(curve) {
    this.#curves.push(curve);
    this.#notify();
  }

  /** Removes the most recently added curve, if any. */
  undo() {
    const removed = this.#curves.pop();
    this.#notify();
    return removed;
  }

  clear() {
    this.#curves.length = 0;
    this.#notify();
  }

  curvesForPattern(patternId) {
    return this.#curves.filter((c) => c.belongsToPattern(patternId));
  }

  hasCurveForPattern(patternId) {
    return this.#curves.some((c) => c.belongsToPattern(patternId));
  }

  /**
   * The only path that should ever flip a curve's visibility - a direct
   * `curve.visible = x` mutation would silently skip notifying listeners
   * (e.g. a 3D scene sync watching for exactly this change). A no-op if
   * `curveId` doesn't match any current curve.
   */
  setVisible(curveId, visible) {
    const curve = this.#curves.find((c) => c.id === curveId);
    if (!curve || curve.visible === visible) return;
    curve.visible = visible;
    this.#notify();
  }

  /**
   * Subscribes to any add/undo/clear/setVisible change. Returns an
   * unsubscribe function.
   * @param {() => void} listener
   * @returns {() => void}
   */
  onChange(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #notify() {
    for (const listener of this.#listeners) listener();
  }
}
