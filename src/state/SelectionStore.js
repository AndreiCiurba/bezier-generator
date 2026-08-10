/**
 * The in-progress manual point selection (before it's committed into a Curve).
 */
export class SelectionStore {
  #points = [];

  get points() {
    return this.#points;
  }

  get count() {
    return this.#points.length;
  }

  add(point) {
    this.#points.push(point);
  }

  /** A curve needs at least 3 points to render (see StringArtRenderer). */
  isReadyForCurve() {
    return this.#points.length >= 3;
  }

  reset() {
    this.#points = [];
  }
}
