import { Point } from './Point.js';
import { findNearestPoint } from './nearestPoint.js';
import { subdivide } from './weaveMath.js';
import { polygonCircumradius, polygonVertices } from './polygonRing.js';

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
   * @param {{rows: number, cols: number, spacing: number, rowHeight: number, layout?: 'standard'|'rotated'|'square'|'hexagon'}} config
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
    if (this.layout === 'standard') this.#points = this.#buildStandard();
    else if (this.layout === 'square') this.#points = this.#buildPolygonRings(4, Math.PI / 4);
    else if (this.layout === 'hexagon') this.#points = this.#buildHexagon();
    else this.#points = this.#buildRotated(); // 'rotated' and any unrecognized value - same fallback as before
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
   * Grid Shape "Hexagon" - a true honeycomb: same rectangular footprint and
   * `x`/`y` formulas as `#buildRotated()` (so the board mesh needs zero
   * changes - it's still just the bounding box of whatever points remain),
   * but with 1 of the triangular lattice's 3 sublattices removed.
   *
   * Every triangular lattice is 3-colorable (no two adjacent points share a
   * color), and each point's 6 neighbors split evenly, 3 of each of the
   * *other* two colors - so dropping any single color class leaves every
   * remaining point with exactly 3 neighbors, all of the other remaining
   * color: a proper honeycomb lattice (the same relationship as graphene's
   * two interleaved triangular sublattices). `#hexSublattice` computes that
   * color from each point's (row, col) via axial hex coordinates (`q = col
   * - floor(row / 2)`, `r = row`, color `= (q - r) mod 3`) - the row/2
   * offset is what "undoes" `#buildRotated`'s own row-parity stagger so
   * adjacent lattice points map to unit steps in axial space, where a
   * linear 3-coloring is well-defined; color 2 (arbitrary - any of the 3
   * works by symmetry) is the one dropped.
   */
  #buildHexagon() {
    const { rows, cols, spacing: s, rowHeight: h } = this;
    const offsetY = cols * s;
    const points = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (row % 2 === 0 && col === 0) continue;
        if (this.#hexSublattice(row, col) === 2) continue;
        const x = row * h;
        const y = offsetY - (col * s + (row % 2) * (s / 2));
        points.push(new Point(x, y));
      }
    }
    return points;
  }

  #hexSublattice(row, col) {
    const q = col - Math.floor(row / 2);
    const r = row;
    return (((q - r) % 3) + 3) % 3;
  }

  /**
   * Grid Shape "Square" - concentric regular-polygon rings of nails (an
   * onion of nested squares) instead of a rectangle filled with the offset
   * triangular lattice. Written generically over `sides` (currently only
   * called with 4, for Square - there's no Pentagon grid shape; a regular
   * pentagon can't tile into a lattice this way at all, unlike Square or
   * Hexagon). `rows` is reused
   * as N, the outermost ring's nails-per-edge count (`cols`/`rowHeight` are
   * unused for this layout, unlike `#buildStandard`/`#buildRotated`). Each
   * ring's edges are subdivided with the same `subdivide()` helper
   * `weaveMath.js` uses for curve weave segments, so nail-to-nail spacing
   * along an edge is exactly `spacing`. `nailsPerEdge` shrinks by 2 per
   * layer inward (same layer decomposition as peeling concentric borders
   * off an N x N grid) down to a single center nail. Rings are centered at
   * (0, 0) - `boundingBox()` still centers everything correctly downstream,
   * so no special-casing is needed by callers.
   * @param {number} sides
   * @param {number} rotationOffset
   */
  #buildPolygonRings(sides, rotationOffset) {
    const { rows: n, spacing: s } = this;
    const points = [];
    const maxLayer = Math.floor((n - 1) / 2);
    for (let layer = 0; layer <= maxLayer; layer++) {
      const nailsPerEdge = n - 2 * layer;
      if (nailsPerEdge <= 1) {
        points.push(new Point(0, 0));
        break;
      }
      const segmentsPerEdge = nailsPerEdge - 1;
      const vertices = polygonVertices(sides, polygonCircumradius(sides, segmentsPerEdge, s), rotationOffset);
      for (let i = 0; i < sides; i++) {
        // Drop the last point of each edge - it's the next edge's first vertex (shared corner).
        points.push(...subdivide(vertices[i], vertices[(i + 1) % sides], segmentsPerEdge).slice(0, -1));
      }
    }
    return points;
  }

  /**
   * Axis-aligned bounding box of every point in the grid - the actual shape
   * the current rows/cols/spacing produce (e.g. tall and narrow for a few
   * cols and many rows, roughly square for a balanced count), not an
   * assumed fixed shape. Used to center the grid within the canvas.
   * @returns {{minX:number, minY:number, maxX:number, maxY:number, width:number, height:number}}
   */
  boundingBox() {
    if (this.#points.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of this.#points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  /**
   * Nearest grid point to `worldPos`, or null if nothing is within `maxDistance`.
   * @param {{x: number, y: number}} worldPos
   * @param {number} maxDistance
   * @returns {Point | null}
   */
  findNearestPoint(worldPos, maxDistance = 10) {
    return findNearestPoint(this.#points, worldPos, maxDistance);
  }
}
