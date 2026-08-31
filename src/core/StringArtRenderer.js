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
   * @param {object} renderer a p5 instance/`p5.Graphics` buffer to draw onto
   *   (anything with `stroke`/`noFill`/`strokeWeight`/`line`) - defaults to
   *   `window`, i.e. the main canvas, matching every original call site.
   *   App.js's Weave live-selection dimming draws non-selected curves onto
   *   its own offscreen buffer instead (see `Curve#renderAlpha`'s own doc
   *   and App.js's `dimBuffer`) so the whole buffer can get one cheap
   *   blur+desaturate composite, rather than filtering per stroke.
   */
  static drawCurve(points, strokes, segments = 8, weight = DEFAULT_STROKE_WEIGHT, renderer = window) {
    StringArtRenderer.#drawSegments(weaveSegmentsForCurve(points, strokes, segments), weight, renderer);
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
   * @param {object} renderer see `drawCurve`'s own doc.
   */
  static drawClosedWeave(cellCorners, n, leap, strokes, weight = DEFAULT_STROKE_WEIGHT, renderer = window) {
    StringArtRenderer.#drawSegments(closedWeaveSegmentsForCurve(cellCorners, n, leap, strokes), weight, renderer);
  }

  static #drawSegments(segments, weight, renderer = window) {
    renderer.strokeWeight(weight);
    renderer.noFill();

    for (const { from, to, color } of segments) {
      renderer.stroke(color);
      renderer.line(from.x, from.y, to.x, to.y);
    }
  }
}
