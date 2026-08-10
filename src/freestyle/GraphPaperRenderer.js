import { computeDivisions, computeGridLines } from './graphPaperMath.js';

// Lighter grey for the bold "every 10th" lines, darker grey for the rest -
// both subtle against the canvas's own near-black background(12) fill.
// MAJOR matches the grid tool's own nail-dot stroke(100) for visual
// consistency across the app.
const MAJOR_LINE_SHADE = 100;
const MINOR_LINE_SHADE = 35;
const LINE_WEIGHT = 1;

/**
 * The "foaie de calcul" backdrop: divides the canvas into square cells (100
 * along its longer side, proportionally fewer along the shorter side - see
 * graphPaperMath.js) with a bold line every 10 cells, like graph paper -
 * makes real-world proportions on the physical board easy to eyeball/count
 * directly on screen. Drawn in world space (inside the viewport transform),
 * so it pans/zooms together with the design, not fixed to the screen.
 */
export class GraphPaperRenderer {
  static draw(width, height) {
    const { cols, rows } = computeDivisions(width, height);
    const verticalLines = computeGridLines(cols, width);
    const horizontalLines = computeGridLines(rows, height);

    strokeWeight(LINE_WEIGHT);

    // Minor lines first, major lines drawn on top last, so a major line
    // always reads as a single clean, uninterrupted line straight through
    // its intersections with minor ones.
    stroke(MINOR_LINE_SHADE);
    for (const { position, major } of verticalLines) {
      if (!major) line(position, 0, position, height);
    }
    for (const { position, major } of horizontalLines) {
      if (!major) line(0, position, width, position);
    }

    stroke(MAJOR_LINE_SHADE);
    for (const { position, major } of verticalLines) {
      if (major) line(position, 0, position, height);
    }
    for (const { position, major } of horizontalLines) {
      if (major) line(0, position, width, position);
    }
  }
}
