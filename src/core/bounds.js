/**
 * True if `point` falls within the axis-aligned rectangle [0, width] x
 * [0, height] - inclusive of the edges. Used to reject canvas point
 * placements that land outside the drawable area.
 */
export function isWithinBounds(point, width, height) {
  return point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height;
}
