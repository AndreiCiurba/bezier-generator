/**
 * Real-world-unit <-> pixel conversion for the freestyle canvas size input
 * ("foaie de calcul" capability - type "20cm" and get pixels back). Pure
 * functions, no DOM/p5 dependency, so this is fully unit-testable.
 */

// How many of each unit fit in one inch - the fixed physical reference point.
// Pixels-per-inch is the one configurable knob (DPI), everything else derives
// from it.
const UNITS_PER_INCH = { in: 1, cm: 2.54, mm: 25.4 };

export const DEFAULT_DPI = 96; // ~37.8 px/cm - standard CSS-pixel reference

/**
 * @param {number} value
 * @param {'px'|'in'|'cm'|'mm'} unit
 * @param {number} dpi pixels per inch; ignored when unit is 'px'
 * @returns {number} pixels
 */
export function toPixels(value, unit, dpi) {
  if (unit === 'px') return value;
  const inches = value / UNITS_PER_INCH[unit];
  return inches * dpi;
}

/**
 * Parses a size string like "20cm", "20 cm", "600px", or a bare "600"
 * (defaults to px). Returns null if it doesn't look like a size at all.
 * @param {string} input
 * @returns {{value: number, unit: 'px'|'in'|'cm'|'mm'} | null}
 */
export function parseSize(input) {
  const match = String(input).trim().match(/^(\d+(?:\.\d+)?)\s*(px|in|cm|mm)?$/i);
  if (!match) return null;

  const value = parseFloat(match[1]);
  if (!Number.isFinite(value)) return null;

  const unit = (match[2] || 'px').toLowerCase();
  return { value, unit };
}

/**
 * Parses a size string and converts it straight to a rounded pixel count.
 * Returns null for unparseable input or a non-positive size.
 * @param {string} input
 * @param {number} dpi
 * @returns {number | null}
 */
export function parseToPixels(input, dpi) {
  const parsed = parseSize(input);
  if (!parsed || parsed.value <= 0) return null;
  return Math.round(toPixels(parsed.value, parsed.unit, dpi));
}
