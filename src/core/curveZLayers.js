/**
 * Pure math for the 3D visualizer's string height model.
 *
 * Per the confirmed spec: height is driven by a string's *color/weave-layer
 * index within its own curve* (not by which curve it is, or how many curves
 * exist) - e.g. with 10 colors, color-layer 1's strings sit at 10% of the
 * nail height, layer 2 at 20%, ..., layer 10 at 100% (exactly the nail
 * height). Every curve that shares the same color count therefore shares the
 * same absolute height per color-layer, regardless of how many other curves
 * exist or in what order they were drawn - unlike an earlier per-curve-index
 * model, adding/removing a curve never shifts any other curve's height.
 *
 * No p5/Three.js dependency - shared by the 3D renderer and any pure test of
 * the layout math itself.
 */

/**
 * `index`'s position within `count` evenly-spaced layers, in (0, 1] -
 * inclusive of 1 (the last layer sits exactly at the top of the range, e.g.
 * the nail height), unlike a curve-index model which would need to stay
 * strictly below it.
 * E.g. count=10 -> layer 0 at 0.1, layer 1 at 0.2, ..., layer 9 at 1.0.
 * @param {number} index 0-based color-layer index
 * @param {number} count total number of colors/layers (must be >= 1)
 * @returns {number}
 */
export function normalizedColorLayerHeight(index, count) {
  return (index + 1) / count;
}

/**
 * `normalizedColorLayerHeight` mapped into a real world height range, e.g.
 * board-top (0) .. nail height.
 * @param {number} index 0-based color-layer index
 * @param {number} count total number of colors/layers
 * @param {number} minHeight world height at normalized 0 (exclusive)
 * @param {number} maxHeight world height at normalized 1 (inclusive) - e.g. the current nail height
 * @returns {number}
 */
export function worldColorLayerHeight(index, count, minHeight, maxHeight) {
  return minHeight + normalizedColorLayerHeight(index, count) * (maxHeight - minHeight);
}
