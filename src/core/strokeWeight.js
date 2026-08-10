/**
 * Pure math for how thick the woven string-art lines should be, based on
 * how many colors are active - no p5/DOM dependency, so it's directly
 * unit-testable. See StringArtRenderer.drawCurve for where this feeds in.
 * Shared by the grid tool and freestyle.
 */

// The line weight the app has always used, and still uses at exactly 8
// colors (today's fixed count) - changing the color count shouldn't change
// anything for anyone who leaves it at the default.
export const BASELINE_COLOR_COUNT = 8;
export const BASELINE_STROKE_WEIGHT = 0.6;

/**
 * Thicker for fewer colors, exactly BASELINE_STROKE_WEIGHT at
 * BASELINE_COLOR_COUNT, thinner for more - plain inverse proportionality
 * (double the colors, half the weight), so the falloff stays clearly
 * visible across the whole range instead of flattening out at the high end
 * (an earlier inverse-square-root version tapered too gently past 8 to
 * read as a real change).
 * @param {number} colorCount
 * @returns {number}
 */
export function strokeWeightForColorCount(colorCount) {
  if (colorCount <= 0) return BASELINE_STROKE_WEIGHT;
  return (BASELINE_STROKE_WEIGHT * BASELINE_COLOR_COUNT) / colorCount;
}
