/**
 * Linearly interpolates between two [r, g, b] colors. `t` is clamped to
 * [0, 1] - 0 returns `colorA`, 1 returns `colorB`.
 * @param {[number,number,number]} colorA
 * @param {[number,number,number]} colorB
 * @param {number} t
 * @returns {[number,number,number]}
 */
export function lerpColor(colorA, colorB, t) {
  const clamped = Math.max(0, Math.min(1, t));
  return colorA.map((c, i) => Math.round(c + (colorB[i] - c) * clamped));
}

/**
 * Interpolates through an ordered list of color stops, evenly spaced across
 * [0, 1] (3 stops sit at 0, 0.5, and 1). Finds which pair of adjacent stops
 * `t` falls between and lerps within just that segment - e.g. grey→yellow
 * for the first half, yellow→red for the second, so the last color is only
 * ever reached right at t=1 instead of being blended in throughout.
 * @param {[number,number,number][]} stops at least one color
 * @param {number} t
 * @returns {[number,number,number]}
 */
export function lerpColorStops(stops, t) {
  if (stops.length === 1) return stops[0];

  const segments = stops.length - 1;
  const scaled = Math.max(0, Math.min(1, t)) * segments;
  const index = Math.min(Math.floor(scaled), segments - 1);
  return lerpColor(stops[index], stops[index + 1], scaled - index);
}
