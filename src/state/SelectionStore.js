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

  /** The most recently added point, or null if nothing's been placed yet. */
  get lastPoint() {
    return this.#points.length > 0 ? this.#points[this.#points.length - 1] : null;
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
