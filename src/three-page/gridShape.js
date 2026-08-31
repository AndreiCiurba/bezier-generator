/**
 * Pure validation for the 3D page's "Grid Shape" selector - lives in the
 * same "Grid Size" submenu as `gridSize.js`'s N control (see `GridSizeUI.js`),
 * matching that module's style.
 *
 * 'triangle' is today's rectangular lattice (Grid.js's `rotated` layout -
 * every neighboring nail triplet forms an equilateral triangle). 'square'
 * is a plain rectangular lattice of its own, no row-parity stagger - every
 * neighboring 2x2 block of nails forms an axis-aligned square (see
 * `Grid.js#buildSquareTiled`). 'hexagon' is a true honeycomb - the same
 * rectangular triangular lattice with 1 of its 3 sublattices removed (see
 * `Grid.js#buildHexagon`). There's no 'pentagon' grid shape at all - unlike
 * a square or a hexagon, a regular pentagon can't tile into a lattice this
 * way.
 */

export const GRID_SHAPES = ['triangle', 'square', 'hexagon'];
export const DEFAULT_GRID_SHAPE = 'triangle';
export const GRID_SHAPE_LABELS = { triangle: 'Triangle', square: 'Square', hexagon: 'Hexagon' };

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isValidGridShape(value) {
  return GRID_SHAPES.includes(value);
}
