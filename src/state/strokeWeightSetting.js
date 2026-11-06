/**
 * Pure validation for the "Stroke Weight" field - lets the artist set the
 * woven line's pixel thickness directly, to match the actual physical thread
 * they're using, instead of only the auto-derived value from color count
 * (see core/strokeWeight.js#strokeWeightForColorCount, still used as this
 * field's starting value, and as the fallback for any curve that never got
 * an explicit weight - see Curve#renderWeight). No DOM/p5 dependency.
 * Shared by both pages, matching this file's own established style
 * (state/colorCount.js).
 */

// Lowered from an earlier 0.1 floor - real string art sometimes uses thread
// thin enough that 0.1px no longer reads as "thin enough," per direct
// feedback from actual physical-board use.
export const MIN_STROKE_WEIGHT = 0.01;
export const MAX_STROKE_WEIGHT = 30;

/**
 * Parses and validates a stroke-weight input. Returns null for anything
 * non-numeric or outside [MIN_STROKE_WEIGHT, MAX_STROKE_WEIGHT].
 * @param {string|number} input
 * @returns {number | null}
 */
export function parseStrokeWeight(input) {
  const value = Number(input);
  if (!Number.isFinite(value)) return null;
  if (value < MIN_STROKE_WEIGHT || value > MAX_STROKE_WEIGHT) return null;
  return value;
}
