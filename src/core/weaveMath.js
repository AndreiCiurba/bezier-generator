import { Point } from './Point.js';

/**
 * Pure geometry behind the string-art "weave" effect - no p5, no drawing calls,
 * so it can be unit tested directly. Split out of the original bezier.js, where
 * this math was interleaved with the p5 `line()` calls that render it.
 */

export function lerpPoint(a, b, t) {
  return new Point(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
}

/** `segments + 1` evenly-spaced points from `a` to `b`, inclusive of both ends. */
export function subdivide(a, b, segments) {
  const points = [];
  for (let j = 0; j <= segments; j++) {
    points.push(lerpPoint(a, b, j / segments));
  }
  return points;
}

/**
 * For one triplet (p1, p2, p3) and one stroke "layer", the {from, to} point
 * pairs that layer draws. Layer 0 fans straight across; each subsequent layer
 * shifts the fan by one point, which is what produces the curved appearance
 * from only straight lines.
 *
 * @param {Point} p1 @param {Point} p2 @param {Point} p3
 * @param {number} layerIndex 0-based stroke/color layer index
 * @param {number} segments how many sub-divisions per side (nails-per-side - 1)
 */
export function computeWeaveSegments(p1, p2, p3, layerIndex, segments = 8) {
  const line1 = subdivide(p1, p2, segments);
  const line2 = subdivide(p2, p3, segments);
  const pairs = [];
  for (let k = 0; k < segments; k++) {
    const toIndex = k + 1 - layerIndex;
    if (toIndex > 0 && toIndex <= segments) {
      pairs.push({ from: line1[k], to: line2[toIndex] });
    }
  }
  return pairs;
}

/**
 * Flattens an entire curve (points + stroke layers) into the full flat list
 * of `{from, to, color}` weave line segments it draws - every enabled
 * layer's `computeWeaveSegments` output across every consecutive triplet, in
 * draw order. Pure data, no p5 calls - the shared source of truth for
 * "what lines does this curve draw", consumed by both `StringArtRenderer`
 * (draws them onto the live canvas via bare p5 calls) and `ExportRenderer`
 * (draws them onto an offscreen `p5.Graphics` buffer for PNG export, which
 * needs its own instance methods rather than the bare globals).
 * @param {{x:number,y:number}[]} points
 * @param {{color:string,enabled:boolean}[]} strokes
 * @param {number} segments
 * @returns {{from: Point, to: Point, color: string}[]}
 */
export function weaveSegmentsForCurve(points, strokes, segments = 8) {
  const result = [];
  for (let i = 0; i < points.length - 2; i++) {
    const [p1, p2, p3] = [points[i], points[i + 1], points[i + 2]];
    strokes.forEach((layer, layerIndex) => {
      if (!layer.enabled) return;
      for (const { from, to } of computeWeaveSegments(p1, p2, p3, layerIndex, segments)) {
        result.push({ from, to, color: layer.color });
      }
    });
  }
  return result;
}
