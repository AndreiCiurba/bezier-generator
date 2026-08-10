/**
 * A plain 2D point/vector, deliberately independent of p5.js.
 *
 * The app used p5's `createVector`/`p5.Vector` for this before, which meant every
 * piece of pure geometry (grid layout, nearest-point search, pattern translation)
 * secretly depended on p5 being loaded. Using this instead lets that logic run -
 * and be unit tested - without a canvas or DOM.
 *
 * Only the handful of operations the app actually used are implemented
 * (copy, set, subtract, distance).
 */
export class Point {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  copy() {
    return new Point(this.x, this.y);
  }

  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

  sub(other) {
    return new Point(this.x - other.x, this.y - other.y);
  }

  add(other) {
    return new Point(this.x + other.x, this.y + other.y);
  }

  distanceTo(other) {
    return Math.hypot(this.x - other.x, this.y - other.y);
  }

  /** Accepts a Point, a p5.Vector, or any {x, y}-shaped object. */
  static from(vectorLike) {
    return new Point(vectorLike.x, vectorLike.y);
  }
}
