/**
 * Pure validation for the "Nail Height" field - the global Z control every
 * 3D nail (and, via `curveZLayers.js`, every curve's Z-layer range) is
 * derived from. No DOM/three.js dependency, matching the established style
 * of `boardControls.js`/`state/strokeWeightSetting.js`.
 */

// Scaled 10x alongside ThreeApp.js's own GRID_SPACING/SceneSync.js's nail
// radii - nails keep their old proportions relative to the new, more spread-
// out lattice; only the woven strings themselves got a lower minimum weight.
export const MIN_NAIL_HEIGHT = 10;
export const MAX_NAIL_HEIGHT = 3000;
export const DEFAULT_NAIL_HEIGHT = 400;

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
