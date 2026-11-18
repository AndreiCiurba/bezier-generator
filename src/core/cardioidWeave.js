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
 * - Threads are numbered 1 .. nailCount by `j` (thread `j` joins nail `j` to
 *   nail `multiplier * j`, nail `nailCount` being nail 0). A `range` keeps
 *   only threads `start .. end`, e.g. 1-24 of 48 is half a cardioid and 25-36
 *   its third quarter. `start > end` wraps past `nailCount` back to 1. Colors
 *   stay tied to the thread number, so hiding threads never recolors the rest.
 * - Nails sit on a circle, or an ellipse `stretch` times as wide as it is
 *   tall, numbered clockwise or counter-clockwise from nail 0 at the top.
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
  return ellipseNailPositions(nailCount, radius);
}

/**
 * `nailCount` nails at even angle steps around an ellipse `radius` tall and
 * `radius * stretch` wide (stretch 1 = circle, < 1 contracts, > 1 widens) -
 * the circle pattern stretched sideways. Nail 0 is at the top; `direction`
 * says which way the numbering runs from there on screen.
 * @param {number} nailCount
 * @param {number} radius
 * @param {{stretch?: number, direction?: 'cw'|'ccw'}} [options]
 * @returns {{x:number, y:number}[]}
 */
export function ellipseNailPositions(nailCount, radius, { stretch = 1, direction = 'cw' } = {}) {
  const sign = direction === 'ccw' ? -1 : 1;
  const nails = [];
  for (let i = 0; i < nailCount; i++) {
    const angle = (sign * 2 * Math.PI * i) / nailCount - Math.PI / 2;
    nails.push({ x: radius * stretch * Math.cos(angle), y: radius * Math.sin(angle) });
  }
  return nails;
}

/**
 * Whether thread `j` (0-based offset; thread number `j`, with 0 counted as
 * `nailCount`) is inside `range`. No range = every thread.
 * @param {number} j
 * @param {number} nailCount
 * @param {{start:number, end:number} | null | undefined} range 1-based, inclusive
 */
export function threadInRange(j, nailCount, range) {
  if (!range) return true;
  const number = j === 0 ? nailCount : j;
  return range.start <= range.end
    ? number >= range.start && number <= range.end
    : number >= range.start || number <= range.end;
}

/**
 * Every chord of one layer.
 * @param {{nailCount:number, multiplier:number, leap:number, layerIndex:number, colorCount:number, range?: {start:number, end:number} | null}} params
 * @returns {{fromIndex:number, toIndex:number, colorIndex:number}[]}
 *   nail indices into `circleNailPositions`, and which of the `colorCount`
 *   colors the chord uses. Chords that would join a nail to itself are
 *   dropped (nothing to draw).
 */
export function layerChords({ nailCount, multiplier, leap, layerIndex, colorCount, range = null }) {
  const start = layerIndex * leap;
  const chords = [];
  for (let j = 0; j < nailCount; j++) {
    if (!threadInRange(j, nailCount, range)) continue;
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

