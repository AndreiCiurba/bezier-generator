import { subdivide } from './weaveMath.js';

/**
 * The physical nail positions one curve actually needs on the board: the
 * "control points" you placed yourself (`curve.points`) plus the "inner"
 * points the weave math subdivides between each consecutive pair of them
 * (see `weaveMath.js#subdivide`) - the same `segments` count used everywhere
 * else for this curve, its own `colors.length`. Pure geometry, no p5
 * dependency - used by the freestyle nails/nails+strings PNG export
 * (backlog item 9).
 *
 * Every {from, to} pair `StringArtRenderer`/`weaveSegmentsForCurve` ever
 * draws for this curve starts and ends on one of `subdivide(points[i],
 * points[i+1], segments)`'s own points - so this is exactly the full set of
 * nails the physical weave actually touches, no more, no less.
 * @param {import('../models/Curve.js').Curve} curve
 * @returns {{controlPoints: import('./Point.js').Point[], innerPoints: import('./Point.js').Point[]}}
 */
export function nailPositionsForCurve(curve) {
  const segments = Math.max(1, curve.colors.length);
  const innerPoints = [];

  for (let i = 0; i < curve.points.length - 1; i++) {
    const edge = subdivide(curve.points[i], curve.points[i + 1], segments);
    innerPoints.push(...edge.slice(1, -1)); // both endpoints are already control points
  }

  return { controlPoints: curve.points, innerPoints };
}
