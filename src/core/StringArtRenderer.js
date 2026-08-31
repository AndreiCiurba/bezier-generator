import { weaveSegmentsForCurve } from './weaveMath.js';
import { closedWeaveSegmentsForCurve } from './closedWeaveMath.js';

const DEFAULT_STROKE_WEIGHT = 0.6; // the app's original, fixed line thickness

/**
 * Draws the string-art weave for a path of nails, one stroke color/layer at a
 * time. Replaces bezier.js's `drawStringArtCurve` (its geometry now lives in
 * weaveMath.js; this is just the p5 drawing side).
 *
 * `drawBezierCurve` and `generateZigzagFromGrid` from the original bezier.js
 * were dropped - neither was wired to any UI control, confirmed dead code.
 */
export class StringArtRenderer {
  /**
   * @param {{x:number,y:number}[]} points the nail path (needs at least 3 points)
   * @param {{color:string,enabled:boolean}[]} strokes one entry per layer
   * @param {number} segments sub-divisions per side; higher = smoother curve
   * @param {number} weight line thickness - freestyle varies this with color
   *   count (see strokeWeight.js); the grid tool leaves it at the default.
   */
  static drawCurve(points, strokes, segments = 8, weight = DEFAULT_STROKE_WEIGHT) {
    StringArtRenderer.#drawSegments(weaveSegmentsForCurve(points, strokes, segments), weight);
  }

  /**
   * Draws a Weave-feature closed-polygon leap weave (see
   * `closedWeaveMath.js`) - the same drawing side as `drawCurve`, just
   * sourcing its segments from a cell's own corners/n/leap instead of an
   * open triplet path.
   * @param {{x:number,y:number}[]} cellCorners
   * @param {number} n inner nails per edge
   * @param {number} leap
   * @param {{color:string,enabled:boolean}[]} strokes
   * @param {number} weight
   */
  static drawClosedWeave(cellCorners, n, leap, strokes, weight = DEFAULT_STROKE_WEIGHT) {
    StringArtRenderer.#drawSegments(closedWeaveSegmentsForCurve(cellCorners, n, leap, strokes), weight);
  }

  static #drawSegments(segments, weight) {
    strokeWeight(weight);
    noFill();

    for (const { from, to, color } of segments) {
      stroke(color);
      line(from.x, from.y, to.x, to.y);
    }
  }
}
