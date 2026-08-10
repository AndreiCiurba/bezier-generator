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
