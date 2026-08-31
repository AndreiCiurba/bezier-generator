import { weaveSegmentsForCurve } from './weaveMath.js';
import { closedWeaveSegmentsForCurve } from './closedWeaveMath.js';
import { nailPositionsForCurve } from './nailPositions.js';
import { controlPointDiameterForColorCount, innerPointDiameterForColorCount } from './nailDotSize.js';

// Print-friendly white, unlike the editor's own dark background(12) - the
// point is a clean template to transfer onto a physical board, not to match
// the on-screen theme.
const BACKGROUND_COLOR = 255;
const DOT_COLOR = 0; // solid black - reads clearly on plain paper

/**
 * Renders a page's curves onto an offscreen `p5.Graphics` buffer for PNG
 * export (freestyle backlog item 9, later ported to the grid tool too) -
 * "nails only" and "nails + strings" variants. Shared by both pages - purely
 * curve-based (never touches a `Grid`/`DeformableGrid` directly), so on the
 * grid tool it naturally reflects whatever nail positions each curve was
 * actually drawn with, deformed or not (each curve already snapshots its own
 * points at creation time - see App.js/FreestyleApp.js).
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
   * Nails only - control and inner points, no strings. Control points are
   * drawn last and wider, so they stay visually prominent.
   * @param {import('p5')} pg an offscreen p5.Graphics buffer
   * @param {import('../models/Curve.js').Curve[]} curves
   * @param {{points: {x:number,y:number}[], colorCount: number}|null} [lattice]
   *   see `#drawNails` - the grid tool's full predefined nail lattice, if any.
   */
  static renderNails(pg, curves, lattice = null) {
    pg.background(BACKGROUND_COLOR);
    ExportRenderer.#drawNails(pg, curves, lattice);
  }

  /**
   * Nails + the actual woven strings, in their real colors - the same weave
   * every curve already renders on screen, plus the nail dots on top.
   * @param {import('p5')} pg an offscreen p5.Graphics buffer
   * @param {import('../models/Curve.js').Curve[]} curves
   * @param {{points: {x:number,y:number}[], colorCount: number}|null} [lattice]
   */
  static renderNailsAndStrings(pg, curves, lattice = null) {
    pg.background(BACKGROUND_COLOR);
    for (const curve of curves) {
      // Its own weight - explicit override if it has one (the manual
      // Stroke Weight setting), else derived from its own color count -
      // never the *current* setting, so this always matches what the curve
      // actually renders as on screen.
      const segments = curve.isClosedWeave
        ? closedWeaveSegmentsForCurve(curve.closedWeave.cellCorners, curve.closedWeave.n, curve.closedWeave.leap, curve.colors)
        : weaveSegmentsForCurve(curve.points, curve.colors, curve.colors.length);
      ExportRenderer.#drawWeave(pg, segments, curve.renderWeight);
    }
    ExportRenderer.#drawNails(pg, curves, lattice);
  }

  static #drawWeave(pg, segments, weight) {
    pg.strokeWeight(weight);
    pg.noFill();
    for (const { from, to, color } of segments) {
      pg.stroke(color);
      pg.line(from.x, from.y, to.x, to.y);
    }
  }

  /**
   * Dot sizes scale with color count (`nailDotSize.js`) - more colors means
   * more, closer-together subdivision points per edge, so a fixed dot size
   * would start overlapping into what reads as a solid line rather than
   * individual nails. Bigger, easier-to-see dots for a sparse, few-color
   * weave; smaller ones for a dense, many-color weave.
   *
   * Inner points always come from each curve's own subdivisions
   * (`nailPositionsForCurve`, sized by that curve's own color count) - extra
   * physical nails the weave needs beyond whatever's already a control
   * point, on either page.
   *
   * Control points differ by page:
   * - **No `lattice`** (freestyle - there's no predefined nail grid, points
   *   land exactly where clicked): only the nails a curve actually uses are
   *   "control points" - `curve.points`, sized by that curve's own color
   *   count, same as always.
   * - **`lattice` given** (the grid tool): *every* predefined nail is a
   *   control point regardless of whether any curve touches it - the whole
   *   board gets physically nailed during setup, not just the nails a
   *   design happens to use. `lattice.points` is expected to already be
   *   *current* (post-deformation) positions - see `DeformableGrid#points` -
   *   sized by `lattice.colorCount` (the live palette size - there's no
   *   single curve to derive it from for a standalone lattice point).
   *   `curve.points` are skipped entirely in this mode: every curve point is
   *   already a lattice nail (curves snap to the grid), so drawing them
   *   again would just be redundant, same-position dots.
   */
  static #drawNails(pg, curves, lattice = null) {
    pg.noStroke();
    pg.fill(DOT_COLOR);

    // Inner points first, so the wider control points always end up on top
    // where a curve's own edges meet - not that they'd usually overlap, but
    // it keeps "control points read as the prominent ones" true regardless.
    for (const curve of curves) {
      const diameter = innerPointDiameterForColorCount(curve.colors.length);
      const { innerPoints } = nailPositionsForCurve(curve);
      for (const p of innerPoints) pg.ellipse(p.x, p.y, diameter, diameter);
    }

    if (lattice) {
      const diameter = controlPointDiameterForColorCount(lattice.colorCount);
      for (const p of lattice.points) pg.ellipse(p.x, p.y, diameter, diameter);
    } else {
      for (const curve of curves) {
        const diameter = controlPointDiameterForColorCount(curve.colors.length);
        for (const p of curve.points) pg.ellipse(p.x, p.y, diameter, diameter);
      }
    }
  }
}
