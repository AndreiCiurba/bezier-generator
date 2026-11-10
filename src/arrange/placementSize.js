/**
 * Placement sizing for the Arrange board. A shape's anchors are in whatever
 * pixel size it happened to be drawn at on /shapes, so that drawing size must
 * not decide how big the shape lands on the board. Instead the board asks for
 * a *target size* (longest side, in board units) and the scale that achieves
 * it is worked out from the shape itself - every shape, old or new, comes out
 * the same size no matter how large it was drawn.
 */

/** Longest side of the bounding box of `points` (the shape's resampled outline). 0 for nothing to measure. */
export function shapeExtent(points) {
  if (points.length === 0) return 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return Math.max(maxX - minX, maxY - minY);
}

/** The scale that makes a shape of the given extent come out `targetSize` long on its longest side; 1 when the shape has no size to scale. */
export function scaleForTargetSize(extent, targetSize) {
  if (!(extent > 0) || !(targetSize > 0)) return 1;
  return targetSize / extent;
}
