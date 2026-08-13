import { Point } from './Point.js';

/**
 * Pure geometry for regular-polygon "rings" - the Grid Shape feature's
 * Square layout (see Grid.js's `#buildPolygonRings`), which arranges nails
 * in concentric polygon outlines instead of filling a rectangle with the
 * triangular offset lattice. Split out as its own small module (rather than
 * living inline inside Grid.js) purely for readability - written generically
 * over `sides` even though only Square (4) uses it today.
 */

/**
 * Circumradius of a regular polygon whose edges are each subdivided into
 * `segmentsPerEdge` nail-to-nail gaps of length `spacing`.
 * @param {number} sides
 * @param {number} segmentsPerEdge
 * @param {number} spacing
 * @returns {number}
 */
export function polygonCircumradius(sides, segmentsPerEdge, spacing) {
  return (spacing * segmentsPerEdge) / (2 * Math.sin(Math.PI / sides));
}

/**
 * The `sides` vertices of a regular polygon with the given circumradius,
 * centered at the origin. `rotationOffset` (radians) rotates away from the
 * default pointy-top orientation (vertex 0 straight up, at angle -90deg) -
 * e.g. `Math.PI / sides` gives a flat-top/axis-aligned orientation instead.
 * @param {number} sides
 * @param {number} radius
 * @param {number} [rotationOffset]
 * @returns {Point[]}
 */
export function polygonVertices(sides, radius, rotationOffset = 0) {
  const vertices = [];
  for (let i = 0; i < sides; i++) {
    const angle = -Math.PI / 2 + rotationOffset + (i * 2 * Math.PI) / sides;
    vertices.push(new Point(radius * Math.cos(angle), radius * Math.sin(angle)));
  }
  return vertices;
}
