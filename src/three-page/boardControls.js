/**
 * Pure validation for the 3D page's board fields - no DOM/three.js
 * dependency, matching the established style of
 * `core/deformation/pinParams.js`/`state/strokeWeightSetting.js`.
 */

export const MIN_BOARD_THICKNESS = 1;
export const MAX_BOARD_THICKNESS = 200;

const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Parses a board thickness. Returns null for anything non-numeric or outside
 * [MIN_BOARD_THICKNESS, MAX_BOARD_THICKNESS].
 * @param {string|number} input
 * @returns {number | null}
 */
export function parseBoardThickness(input) {
  const value = Number(input);
  if (!Number.isFinite(value)) return null;
  if (value < MIN_BOARD_THICKNESS || value > MAX_BOARD_THICKNESS) return null;
  return value;
}

/**
 * Parses a board color. Returns null for anything that isn't a `#rgb` or
 * `#rrggbb` hex string (what a native `<input type="color">` always yields,
 * but validated anyway rather than trusted blindly).
 * @param {string} input
 * @returns {string | null}
 */
export function parseBoardColor(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  return HEX_COLOR_RE.test(trimmed) ? trimmed : null;
}
