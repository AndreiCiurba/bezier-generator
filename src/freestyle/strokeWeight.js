/**
 * Pure math for how thick the woven string-art lines should be, based on
 * how many colors are active - no p5/DOM dependency, so it's directly
 * unit-testable. See StringArtRenderer.drawCurve for where this feeds in.
 */

// The line weight the app has always used, and still uses at exactly 8
// colors (today's fixed count) - changing the color count shouldn't change
// anything for anyone who leaves it at the default.
export const BASELINE_COLOR_COUNT = 8;
export const BASELINE_STROKE_WEIGHT = 0.6;

/**
 * Thicker for fewer colors, exactly BASELINE_STROKE_WEIGHT at
 * BASELINE_COLOR_COUNT, gradually thinner for more - an inverse-square-root
 * falloff so it tapers gently at the high end (25 colors is noticeably but
 * not drastically thinner than 8) while still doubling in thickness by 2
 * colors, quadrupling by 1.
 * @param {number} colorCount
 * @returns {number}
 */
export function strokeWeightForColorCount(colorCount) {
  if (colorCount <= 0) return BASELINE_STROKE_WEIGHT;
  return BASELINE_STROKE_WEIGHT * Math.sqrt(BASELINE_COLOR_COUNT / colorCount);
}
