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
  for (let i = 0; i < nailCount; i++) nails.push(circlePointAt(i, nailCount, radius));
  return nails;
}

/**
 * The point on the circle at nail index `index` - the same formula
 * `circleNailPositions` uses, but `index` may be fractional (a point part-way
 * between two nails). Only the reel timeline needs that (see
 * `cardioid/cardioidReelFrame.js`): animating the multiplier or the leap
 * smoothly between whole numbers lands chord ends between nails mid-move.
 * @param {number} index
 * @param {number} nailCount
 * @param {number} radius
 * @returns {{x:number, y:number}}
 */
export function circlePointAt(index, nailCount, radius) {
  const angle = (2 * Math.PI * index) / nailCount - Math.PI / 2;
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

/**
 * How many of one layer's chords are drawn yet when the board is only
 * `progress` (0..1) of the way through being strung - the "watch it being
 * woven" reveal a reel plays.
 * - `sequential`: one thread strings the whole board, layer after layer from
 *   the bottom, so a layer is empty until every layer below it is finished.
 * - `parallel`: every layer is strung at once, each as far along as the rest.
 *
 * The answer is not rounded: the whole part is how many chords are finished,
 * and the fraction is how far the next one has been pulled from its first
 * nail toward its second - so a slow build-up shows each string travelling
 * across the board rather than appearing all at once.
 * @param {{layerIndex:number, layerCount:number, chordsPerLayer:number, progress:number, mode?:'sequential'|'parallel'}} params
 * @returns {number} 0 .. chordsPerLayer
 */
export function chordDrawAmount({ layerIndex, layerCount, chordsPerLayer, progress, mode = 'sequential' }) {
  const clamped = Math.min(1, Math.max(0, progress));
  if (mode === 'parallel') return clamped * chordsPerLayer;
  const drawn = clamped * layerCount * chordsPerLayer - layerIndex * chordsPerLayer;
  return Math.min(chordsPerLayer, Math.max(0, drawn));
}

/**
 * How far nail `nailIndex` has been driven into the board when `progress`
 * (0..1) of the nails are in - nails go in one after another round the
 * circle, the "hammering the board together" part of a making-of reel.
 * @param {{nailIndex:number, nailCount:number, progress:number}} params
 * @returns {number} 0 (not placed yet) .. 1 (fully in); in between, the nail is standing proud mid-hammering
 */
export function nailSeating({ nailIndex, nailCount, progress }) {
  const driven = Math.min(1, Math.max(0, progress)) * nailCount - nailIndex;
  return Math.min(1, Math.max(0, driven));
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
 * The two straight strings that stand in for one chord when the thread goes
 * *around* its nails rather than through their centers: two parallel lines,
 * each shifted sideways by half the nail thickness, so the gap between them is
 * exactly `nailThickness`. (A real string wrapped round both nails touches
 * them on the same side at each end, which is this outer-tangent pair.) A
 * thickness of 0 (or a zero-length chord) gives just the one center line.
 * @param {{x:number,y:number}} from
 * @param {{x:number,y:number}} to
 * @param {number} nailThickness diameter of the nail, in world units
 * @returns {{from:{x:number,y:number}, to:{x:number,y:number}}[]}
 */
export function parallelStrings(from, to, nailThickness) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (nailThickness <= 0 || length === 0) return [{ from, to }];
  const half = nailThickness / 2;
  const ox = (-dy / length) * half; // unit normal to the chord, scaled to half the thickness
  const oy = (dx / length) * half;
  return [
    { from: { x: from.x + ox, y: from.y + oy }, to: { x: to.x + ox, y: to.y + oy } },
    { from: { x: from.x - ox, y: from.y - oy }, to: { x: to.x - ox, y: to.y - oy } },
  ];
}

/**
 * The curve a thread follows where it turns around one nail: an arc of the
 * nail's circle joining the tangent points of the strings that leave it. Each
 * string toward direction `d` touches the nail at the two points 90 degrees
 * either side of `d`; the thread goes round the back, away from every
 * string, so the arc is whatever is left after cutting out the widest empty
 * gap between those points (a "back of the nail" point is added per string so
 * a nail with a single string wraps a clean half turn).
 * @param {{x:number,y:number}} center the nail
 * @param {number} radius half the nail thickness
 * @param {{x:number,y:number}[]} directions toward the far end of each string leaving this nail (need not be unit length)
 * @param {number} [stepsPerHalfTurn]
 * @returns {{x:number,y:number}[]} points along the arc, in order; empty when there is nothing to wrap
 */
export function wrapArc(center, radius, directions, stepsPerHalfTurn = 8) {
  if (radius <= 0 || directions.length === 0) return [];
  const TWO_PI = Math.PI * 2;
  const norm = (a) => ((a % TWO_PI) + TWO_PI) % TWO_PI;
  const angles = [];
  for (const d of directions) {
    const phi = Math.atan2(d.y, d.x);
    angles.push(norm(phi + Math.PI / 2), norm(phi - Math.PI / 2), norm(phi + Math.PI));
  }
  angles.sort((a, b) => a - b);

  // Widest gap between neighbouring angles (including the wrap-around one):
  // the arc starts where that gap ends and runs the long way round to where it begins.
  let widest = -1;
  let start = angles[0];
  let sweep = 0;
  for (let i = 0; i < angles.length; i++) {
    const next = i + 1 < angles.length ? angles[i + 1] : angles[0] + TWO_PI;
    const gap = next - angles[i];
    if (gap > widest) {
      widest = gap;
      start = next;
      sweep = TWO_PI - gap;
    }
  }
  const steps = Math.max(1, Math.ceil((sweep / Math.PI) * stepsPerHalfTurn));
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const a = start + (sweep * i) / steps;
    points.push({ x: center.x + radius * Math.cos(a), y: center.y + radius * Math.sin(a) });
  }
  return points;
}

