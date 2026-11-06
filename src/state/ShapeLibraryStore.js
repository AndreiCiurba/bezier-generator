/**
 * Committed `FreeformShape`s from the Shape Designer - the shape equivalent
 * of `PatternStore`, minus any placement-mode fields (placement happens on
 * the separate Arrange board page, not here). Unlike `PatternStore`, this
 * notifies on every mutation (`onChange`), matching `CurveStore`/
 * `StrokePalette`'s convention instead - the library list panel needs to
 * reflect add/remove/rename regardless of which UI action triggered it.
 */
export class ShapeLibraryStore {
  #shapes = [];
  #listeners = new Set();

  get shapes() {
    return this.#shapes;
  }

  get count() {
    return this.#shapes.length;
  }

  add(shape) {
    this.#shapes.push(shape);
    this.#notify();
  }

  findById(id) {
    return this.#shapes.find((s) => s.id === id) ?? null;
  }

  remove(id) {
    const index = this.#shapes.findIndex((s) => s.id === id);
    if (index === -1) return;
    this.#shapes.splice(index, 1);
    this.#notify();
  }

  rename(id, name) {
    const shape = this.findById(id);
    if (!shape) return;
    shape.name = name;
    this.#notify();
  }

  /**
   * Replaces the whole saved-shapes list, e.g. after importing a JSON file
   * exported from this same page - mirrors `PatternStore#importPatterns`/
   * `WeaveState#importRecipes`.
   * @param {unknown[]} rawShapes
   * @param {typeof import('../models/FreeformShape.js').FreeformShape} ShapeClass
   */
  importShapes(rawShapes, ShapeClass) {
    for (const raw of rawShapes) {
      if (raw.id && raw.name && Array.isArray(raw.anchors) && typeof raw.nailCount === 'number') {
        this.#shapes.push(ShapeClass.fromJSON(raw));
      }
    }
    this.#notify();
  }

  /**
   * Subscribes to any add/remove/rename/importShapes change. Returns an
   * unsubscribe function - same shape as `CurveStore#onChange`.
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
