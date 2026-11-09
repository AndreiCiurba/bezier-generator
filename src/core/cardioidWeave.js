/**
 * Pure math for the Cardioid board: one circle of evenly spaced nails, woven
 * as a "times table" (nail `j` is joined to nail `multiplier * j`, so the
 * default multiplier 2 envelopes a cardioid; 3 gives a nephroid, ...), stacked
 * into layers.
 *
 * Each layer is the same weave, rotated around the circle:
 * - Layer `k` starts at nail `k * leap`. Counting from that start nail,
 *   offset `j` (0 .. nailCount - 1) joins nail `start + j` to nail
 *   `start + multiplier * j` (mod nailCount) - i.e. the layer is the layer-0
 *   pattern turned by `k * leap` nails. `leap = 0` stacks identical layers.
 * - A layer's chords are split into `colorCount` equal, contiguous groups by
 *   `j`: with 2 colors the first half of the start nails is color A and the
 *   second half color B; with 3, a third each; and so on.
 *
 * No Three.js/DOM dependency, so it is directly unit-testable.
 */

function mod(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

/**
 * `nailCount` points evenly spaced around a circle of `radius`, nail 0 at the
 * top of the board (2D y negative = "up" on screen).
 * @param {number} nailCount
 * @param {number} radius
 * @returns {{x:number, y:number}[]}
 */
export function circleNailPositions(nailCount, radius) {
  const nails = [];
  for (let i = 0; i < nailCount; i++) {
    const angle = (2 * Math.PI * i) / nailCount - Math.PI / 2;
    nails.push({ x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
  }
  return nails;
}

/**
 * Every chord of one layer.
 * @param {{nailCount:number, multiplier:number, leap:number, layerIndex:number, colorCount:number}} params
 * @returns {{fromIndex:number, toIndex:number, colorIndex:number}[]}
 *   nail indices into `circleNailPositions`, and which of the `colorCount`
 *   colors the chord uses. Chords that would join a nail to itself are
 *   dropped (nothing to draw).
 */
export function layerChords({ nailCount, multiplier, leap, layerIndex, colorCount }) {
  const start = layerIndex * leap;
  const chords = [];
  for (let j = 0; j < nailCount; j++) {
    const fromIndex = mod(start + j, nailCount);
    const toIndex = mod(start + multiplier * j, nailCount);
    if (fromIndex === toIndex) continue;
    chords.push({ fromIndex, toIndex, colorIndex: Math.min(colorCount - 1, Math.floor((j * colorCount) / nailCount)) });
  }
  return chords;
}

/**
 * String weight for a layer: `bottomWeight` on layer 0 (closest to the
 * board), tapering linearly to `topWeight` on the last layer. A single layer
 * just uses `bottomWeight`.
 * @param {number} layerIndex
 * @param {number} layerCount
 * @param {number} bottomWeight
 * @param {number} topWeight
 */
export function layerWeight(layerIndex, layerCount, bottomWeight, topWeight) {
  if (layerCount <= 1) return bottomWeight;
  return bottomWeight + ((topWeight - bottomWeight) * layerIndex) / (layerCount - 1);
}
