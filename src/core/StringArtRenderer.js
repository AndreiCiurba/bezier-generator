import { computeWeaveSegments } from './weaveMath.js';

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
   */
  static drawCurve(points, strokes, segments = 8) {
    strokeWeight(0.6);
    noFill();

    for (let i = 0; i < points.length - 2; i++) {
      const [p1, p2, p3] = [points[i], points[i + 1], points[i + 2]];

      strokes.forEach((layer, layerIndex) => {
        if (!layer.enabled) return;
        stroke(layer.color);
        for (const { from, to } of computeWeaveSegments(p1, p2, p3, layerIndex, segments)) {
          line(from.x, from.y, to.x, to.y);
        }
      });
    }
  }
}
