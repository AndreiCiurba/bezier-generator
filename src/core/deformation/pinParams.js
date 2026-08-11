/**
 * Pure validation for the Deformation panel's radius/falloff fields - no
 * DOM/p5 dependency, matching state/colorCount.js's established style.
 */

export const MIN_PIN_RADIUS = 1;
export const MAX_PIN_RADIUS = 5000;
export const MIN_PIN_FALLOFF = 0.1;
export const MAX_PIN_FALLOFF = 10;

/**
 * Parses a pin influence radius. Returns null for anything non-numeric or
 * outside [MIN_PIN_RADIUS, MAX_PIN_RADIUS].
 * @param {string|number} input
 * @returns {number | null}
 */
export function parsePinRadius(input) {
  const value = Number(input);
  if (!Number.isFinite(value)) return null;
  if (value < MIN_PIN_RADIUS || value > MAX_PIN_RADIUS) return null;
  return value;
}

/**
 * Parses a pin falloff exponent (see core/deformation/puppetWarp.js -
 * higher sharpens the cutoff near the radius's edge, lower is gentler).
 * Returns null for anything non-numeric or outside [MIN_PIN_FALLOFF,
 * MAX_PIN_FALLOFF].
 * @param {string|number} input
 * @returns {number | null}
 */
export function parsePinFalloff(input) {
  const value = Number(input);
  if (!Number.isFinite(value)) return null;
  if (value < MIN_PIN_FALLOFF || value > MAX_PIN_FALLOFF) return null;
  return value;
}
