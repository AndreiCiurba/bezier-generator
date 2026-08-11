import { weaveSegmentsForCurve } from '../core/weaveMath.js';
import { nailPositionsForCurve } from '../core/nailPositions.js';
import { strokeWeightForColorCount } from '../core/strokeWeight.js';

// Print-friendly white, unlike the editor's own dark background(12) - the
// point is a clean template to transfer onto a physical board, not to match
// the on-screen theme.
const BACKGROUND_COLOR = 255;
const DOT_COLOR = 0; // solid black - reads clearly on plain paper
const CONTROL_POINT_DIAMETER = 10;
const INNER_POINT_DIAMETER = 4;

/**
 * Renders the freestyle canvas's curves onto an offscreen `p5.Graphics`
 * buffer for PNG export (backlog item 9) - "nails only" and "nails +
 * strings" variants.
 *
 * Deliberately doesn't reuse `StringArtRenderer`/`CanvasView`: those draw via
 * bare global p5 calls (`stroke()`, `line()`, ...), which in p5's global mode
 * always target the *visible* canvas - there's no way to redirect a bare
 * call at an offscreen buffer. Drawing onto a `p5.Graphics` instead requires
 * calling its own methods (`pg.stroke()`, `pg.line()`, ...), so this class
 * does that directly - but still shares the actual weave math
 * (`weaveSegmentsForCurve`) and nail-position math (`nailPositionsForCurve`)
 * with the live renderer, so only the "which drawing calls" part is
 * duplicated, not any geometry.
 */
export class ExportRenderer {
  /**
   * Nails only - every curve's control and inner points, no strings. Control
   * points are drawn both last and wider, so they stay visually prominent.
   * @param {import('p5')} pg an offscreen p5.Graphics buffer
   * @param {import('../models/Curve.js').Curve[]} curves
   */
  static renderNails(pg, curves) {
    pg.background(BACKGROUND_COLOR);
    ExportRenderer.#drawNails(pg, curves);
  }

  /**
   * Nails + the actual woven strings, in their real colors - the same weave
   * every curve already renders on screen, plus the nail dots on top.
   * @param {import('p5')} pg an offscreen p5.Graphics buffer
   * @param {import('../models/Curve.js').Curve[]} curves
   */
  static renderNailsAndStrings(pg, curves) {
    pg.background(BACKGROUND_COLOR);
    for (const curve of curves) {
      ExportRenderer.#drawWeave(
        pg,
        curve.points,
        curve.colors,
        curve.colors.length,
        strokeWeightForColorCount(curve.colors.length)
      );
    }
    ExportRenderer.#drawNails(pg, curves);
  }

  static #drawWeave(pg, points, strokes, segments, weight) {
    pg.strokeWeight(weight);
    pg.noFill();
    for (const { from, to, color } of weaveSegmentsForCurve(points, strokes, segments)) {
      pg.stroke(color);
      pg.line(from.x, from.y, to.x, to.y);
    }
  }

  static #drawNails(pg, curves) {
    pg.noStroke();
    pg.fill(DOT_COLOR);

    // Inner points first, so the wider control points always end up on top
    // where a curve's own edges meet - not that they'd usually overlap, but
    // it keeps "control points read as the prominent ones" true regardless.
    for (const curve of curves) {
      const { innerPoints } = nailPositionsForCurve(curve);
      for (const p of innerPoints) pg.ellipse(p.x, p.y, INNER_POINT_DIAMETER, INNER_POINT_DIAMETER);
    }
    for (const curve of curves) {
      for (const p of curve.points) pg.ellipse(p.x, p.y, CONTROL_POINT_DIAMETER, CONTROL_POINT_DIAMETER);
    }
  }
}
