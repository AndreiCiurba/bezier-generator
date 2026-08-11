import { Point } from './Point.js';

/**
 * Pure point-array transforms shared by pattern placement and preview
 * rendering - no p5/DOM dependency, so directly unit-testable.
 */

/**
 * Mirrors `points` around `points[0]` (which stays fixed) - horizontally
 * (left-right), vertically (top-bottom), both, or neither. Used for the
 * hold-V/hold-H pattern flip: the point that gets anchored to the cursor
 * doesn't move, only the rest of the shape mirrors around it.
 * @param {{x:number,y:number}[]} points
 * @param {{horizontal?: boolean, vertical?: boolean}} [flip]
 * @returns {Point[]}
 */
export function flipPoints(points, { horizontal = false, vertical = false } = {}) {
  if (!horizontal && !vertical) return points.map((p) => Point.from(p));

  const pivot = points[0];
  return points.map(
    (p) =>
      new Point(
        horizontal ? 2 * pivot.x - p.x : p.x,
        vertical ? 2 * pivot.y - p.y : p.y
      )
  );
}

/**
 * Translated copy of `points` so that `points[0]` lands exactly on `anchor`.
 * @param {{x:number,y:number}[]} points
 * @param {{x:number,y:number}} anchor
 * @returns {Point[]}
 */
export function translatePointsTo(points, anchor) {
  const first = Point.from(points[0]);
  const offset = first.sub(anchor);
  return points.map((p) => Point.from(p).sub(offset));
}
