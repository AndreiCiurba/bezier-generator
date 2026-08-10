import { Point } from './Point.js';

/**
 * The lattice of "nails" the whole app is built around.
 *
 * Replaces grid.js. Two behavioral changes from the original:
 *  - `standard` and `rotated` layouts are methods on one class instead of two
 *    free functions that both mutated a shared module-level `points` array.
 *  - `findNearestPoint` does a real nearest-neighbor search. The original
 *    `handleMousePressed` / `renderPattern` both looped over every point and
 *    took the *first* one within 10px, which (a) is order-dependent - an
 *    earlier, farther point can win over a later, closer one - and (b) left
 *    callers to deal with `undefined` by crashing rather than a clean "no match".
 */
export class Grid {
  #points = [];

  /**
   * @param {{rows: number, cols: number, spacing: number, rowHeight: number, layout?: 'standard'|'rotated'}} config
   */
  constructor({ rows, cols, spacing, rowHeight, layout = 'rotated' }) {
    this.rows = rows;
    this.cols = cols;
    this.spacing = spacing;
    this.rowHeight = rowHeight;
    this.layout = layout;
    this.generate();
  }

  get points() {
    return this.#points;
  }

  generate() {
    this.#points =
      this.layout === 'standard' ? this.#buildStandard() : this.#buildRotated();
    return this.#points;
  }

  #buildStandard() {
    const { rows, cols, spacing: s, rowHeight: h } = this;
    const points = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (row % 2 === 0 && col === 0) continue;
        const x = col * s + (row % 2) * (s / 2);
        const y = row * h;
        points.push(new Point(x, y));
      }
    }
    return points;
  }

  #buildRotated() {
    const { rows, cols, spacing: s, rowHeight: h } = this;
    const offsetY = cols * s;
    const points = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (row % 2 === 0 && col === 0) continue;
        const x = row * h;
        const y = offsetY - (col * s + (row % 2) * (s / 2));
        points.push(new Point(x, y));
      }
    }
    return points;
  }

  /**
   * Nearest grid point to `worldPos`, or null if nothing is within `maxDistance`.
   * @param {{x: number, y: number}} worldPos
   * @param {number} maxDistance
   * @returns {Point | null}
   */
  findNearestPoint(worldPos, maxDistance = 10) {
    let nearest = null;
    let nearestDist = Infinity;
    for (const p of this.#points) {
      const d = p.distanceTo(worldPos);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = p;
      }
    }
    return nearestDist <= maxDistance ? nearest : null;
  }
}
