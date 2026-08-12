/**
 * Pure validation for the "Nail Height" field - the global Z control every
 * 3D nail (and, via `curveZLayers.js`, every curve's Z-layer range) is
 * derived from. No DOM/three.js dependency, matching the established style
 * of `boardControls.js`/`state/strokeWeightSetting.js`.
 */

export const MIN_NAIL_HEIGHT = 1;
export const MAX_NAIL_HEIGHT = 300;
export const DEFAULT_NAIL_HEIGHT = 40;

/**
 * Parses a nail height. Returns null for anything non-numeric or outside
 * [MIN_NAIL_HEIGHT, MAX_NAIL_HEIGHT].
 * @param {string|number} input
 * @returns {number | null}
 */
export function parseNailHeight(input) {
  const value = Number(input);
  if (!Number.isFinite(value)) return null;
  if (value < MIN_NAIL_HEIGHT || value > MAX_NAIL_HEIGHT) return null;
  return value;
}
