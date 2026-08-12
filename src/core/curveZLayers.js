/**
 * Pure math for the 3D visualizer's string height model.
 *
 * Per the confirmed spec: height is driven by a string's *color/weave-layer
 * index within its own curve* (not by which curve it is, or how many curves
 * exist) - e.g. with 10 colors, color-layer 1's strings sit at 1/11 (~9.1%)
 * of the nail height, layer 2 at 2/11 (~18.2%), ..., layer 10 at 10/11
 * (~90.9%). Every curve that shares the same color count therefore shares
 * the same absolute height per color-layer, regardless of how many other
 * curves exist or in what order they were drawn - unlike an earlier
 * per-curve-index model, adding/removing a curve never shifts any other
 * curve's height.
 *
 * No p5/Three.js dependency - shared by the 3D renderer and any pure test of
 * the layout math itself.
 */

/**
 * `index`'s position within `count` evenly-spaced layers, dividing the full
 * [0, 1] range into `count + 1` equal sections and placing each layer at one
 * of the `count` interior division points (1 through `count`), never at
 * either end - so there's an equal margin at both the bottom (board/base)
 * and the top (nail tip): the last layer never sits directly on the tip, the
 * same way the first never sits directly on the board.
 * E.g. count=10 -> layer 0 at 1/11, layer 1 at 2/11, ..., layer 9 at 10/11.
 * @param {number} index 0-based color-layer index
 * @param {number} count total number of colors/layers (must be >= 1)
 * @returns {number}
 */
export function normalizedColorLayerHeight(index, count) {
  return (index + 1) / (count + 1);
}

/**
 * `normalizedColorLayerHeight` mapped into a real world height range, e.g.
 * board-top (0) .. nail height. Since no layer's normalized height ever
 * actually reaches 0 or 1 (see that function's own doc), no layer's world
 * height ever actually reaches `minHeight` or `maxHeight` either - both are
 * just the ends of the range being interpolated across.
 * @param {number} index 0-based color-layer index
 * @param {number} count total number of colors/layers
 * @param {number} minHeight world height at normalized 0
 * @param {number} maxHeight world height at normalized 1 - e.g. the current nail height
 * @returns {number}
 */
export function worldColorLayerHeight(index, count, minHeight, maxHeight) {
  return minHeight + normalizedColorLayerHeight(index, count) * (maxHeight - minHeight);
}
