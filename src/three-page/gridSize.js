/**
 * Pure validation for the 3D page's "Grid Size" field - no DOM/three.js
 * dependency, matching the established style of `state/colorCount.js`.
 *
 * Unlike the 2D grid tool's fixed 15x13 rectangular lattice, the 3D page's
 * board is always square (N x N), and its size is user-selectable - see
 * `GridSizeUI.js`.
 */

export const MIN_GRID_SIZE = 3;
export const MAX_GRID_SIZE = 41;
export const DEFAULT_GRID_SIZE = 13;

/** Common square sizes offered in the preset dropdown - "Custom…" covers anything else. */
export const GRID_SIZE_PRESETS = [9, 11, 13, 15, 17];

/**
 * Parses and validates a grid-size (N, for an N x N square lattice) input.
 * Returns null for anything non-numeric or outside [MIN_GRID_SIZE, MAX_GRID_SIZE].
 * @param {string|number} input
 * @returns {number | null}
 */
export function parseGridSize(input) {
  const value = Math.round(Number(input));
  if (!Number.isFinite(value)) return null;
  if (value < MIN_GRID_SIZE || value > MAX_GRID_SIZE) return null;
  return value;
}
