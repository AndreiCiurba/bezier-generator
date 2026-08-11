/**
 * Pure math for how big the exported nail dots should be, based on a curve's
 * own color count - no p5 dependency. Mirrors `strokeWeight.js`'s own
 * inverse-proportionality reasoning: `segments` always equals `colors.length`
 * everywhere in this app, so more colors means more, closer-together
 * subdivision points along each edge. A fixed dot size starts overlapping
 * neighboring dots at high color counts, reading as a solid line instead of
 * individual nail positions - shrinking the dots as color count grows keeps
 * them individually legible. Fewer colors means fewer, more widely-spaced
 * points, so bigger dots read fine (and are easier to see/measure when
 * physically transferring to a board).
 */

// Matches strokeWeight.js's own baseline - a no-op at today's 8-color
// default, exactly the existing dot sizes, for anyone who never touches the
// color count.
const BASELINE_COLOR_COUNT = 8;
export const BASELINE_CONTROL_POINT_DIAMETER = 10;
export const BASELINE_INNER_POINT_DIAMETER = 4;

// Plain inverse proportionality (like strokeWeightForColorCount) would blow
// up to an absurd ~80px dot at colorCount=1 - clamped to a sane range
// instead, so "big dots for few colors" stays a *readable* big, and "small
// dots for many colors" never shrinks to invisible.
const CONTROL_POINT_RANGE = { min: 3, max: 20 };
const INNER_POINT_RANGE = { min: 1.5, max: 8 };

function diameterForColorCount(colorCount, baselineDiameter, { min, max }) {
  if (colorCount <= 0) return baselineDiameter;
  const scaled = (baselineDiameter * BASELINE_COLOR_COUNT) / colorCount;
  return Math.min(max, Math.max(min, scaled));
}

/** @param {number} colorCount @returns {number} diameter in px */
export function controlPointDiameterForColorCount(colorCount) {
  return diameterForColorCount(colorCount, BASELINE_CONTROL_POINT_DIAMETER, CONTROL_POINT_RANGE);
}

/** @param {number} colorCount @returns {number} diameter in px */
export function innerPointDiameterForColorCount(colorCount) {
  return diameterForColorCount(colorCount, BASELINE_INNER_POINT_DIAMETER, INNER_POINT_RANGE);
}
