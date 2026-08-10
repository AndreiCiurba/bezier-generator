/**
 * Pure math behind the "foaie de calcul" (graph paper) backdrop - no p5, no
 * DOM, so it's directly unit-testable. See GraphPaperRenderer.js for the
 * drawing side.
 */

const DIVISIONS_LONG_AXIS = 100;
const MAJOR_EVERY = 10;

/**
 * How many cells to divide each axis into so the cells come out square
 * regardless of the canvas's aspect ratio: the longer axis always gets 100
 * divisions, the shorter axis gets proportionally fewer (e.g. a 2:1
 * rectangle gets 100 x 50, not 100 x 100 stretched).
 * @param {number} width @param {number} height
 * @returns {{cols: number, rows: number}}
 */
export function computeDivisions(width, height) {
  if (width <= 0 || height <= 0) return { cols: 0, rows: 0 };

  if (width >= height) {
    return {
      cols: DIVISIONS_LONG_AXIS,
      rows: Math.max(1, Math.round((DIVISIONS_LONG_AXIS * height) / width)),
    };
  }
  return {
    cols: Math.max(1, Math.round((DIVISIONS_LONG_AXIS * width) / height)),
    rows: DIVISIONS_LONG_AXIS,
  };
}

/**
 * Evenly-spaced line positions across [0, length] for `divisions` cells
 * (divisions + 1 lines, including both edges), each tagged major/minor -
 * major every 10th line counting from 0, matching classic graph paper's
 * bold lines.
 * @param {number} divisions @param {number} length
 * @returns {{position: number, major: boolean}[]}
 */
export function computeGridLines(divisions, length) {
  if (divisions <= 0) return [];

  const lines = [];
  for (let i = 0; i <= divisions; i++) {
    lines.push({ position: (i / divisions) * length, major: i % MAJOR_EVERY === 0 });
  }
  return lines;
}
