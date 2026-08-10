/**
 * Pure validation for the freestyle "number of colors" input - no DOM/p5
 * dependency, so it's directly unit-testable.
 */

export const MIN_COLORS = 1;
export const MAX_COLORS = 25;

/**
 * Parses and validates a color-count input. Returns null for anything
 * non-numeric or outside [MIN_COLORS, MAX_COLORS].
 * @param {string|number} input
 * @returns {number | null}
 */
export function parseColorCount(input) {
  const value = Math.round(Number(input));
  if (!Number.isFinite(value)) return null;
  if (value < MIN_COLORS || value > MAX_COLORS) return null;
  return value;
}
