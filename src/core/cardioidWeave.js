/**
 * Pure math for the Cardioid board: one circle of evenly spaced nails, woven
 * as a "times table" (nail `j` is joined to nail `multiplier * j`, so the
 * default multiplier 2 envelopes a cardioid; 3 gives a nephroid, ...), stacked
 * into layers.
 *
 * A layer is a stack of **runs**, each like its own pass of the times table:
 * - A run has a `rotation` (the nail its pattern starts from), a thread
 *   `range`, a color, and optionally its own multiplier and leap (otherwise
 *   the shared ones).
 * - Threads are numbered 1 .. nailCount by `j` (thread `j` joins nail
 *   `start + j` to nail `start + multiplier * j`, mod nailCount, where
 *   `start = rotation + layerIndex * leap`; thread `nailCount` is `j = 0`).
 *   E.g. with 48 nails, a run of threads 1-24 is half a cardioid and 24-47 the
 *   other half; three nephroid runs of threads 1-6 turned 0, 16 and 32 nails
 *   give 1-3 .. 6-18, 17-19 .. 22-34 and 33-35 .. 38-2. A range whose start
 *   is after its end wraps past `nailCount` back to 1.
 * - The thread runs out and back round its nails, so every chord is two
 *   strands - except the last chord of a run, where the thread ends going one
 *   way only (`single`).
 * - Layer `k` repeats the whole stack, each run turned by `k * leap` nails
 *   (its own leap, or the shared one). `leap = 0` stacks identical layers.
 * - Within a layer, runs sit one above the other in stack order
 *   (`stackIndex`, 0 = against the layer below).
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
 * The chords of one run on one layer, in the order they are strung (thread
 * `range.start` first, up to `range.end`). Chords that would join a nail to
 * itself are dropped (nothing to draw). The last chord is marked `single`:
 * the thread ends there, so it crosses once instead of out and back.
 * @param {{nailCount:number, multiplier:number, leap:number, layerIndex:number, rotation?:number, range?: {start:number, end:number} | null}} params
 * @returns {{fromIndex:number, toIndex:number, thread:number, single:boolean}[]} nail indices into `ellipseNailPositions`
 */
export function runChords({ nailCount, multiplier, leap, layerIndex, rotation = 0, range = null }) {
  const start = rotation + layerIndex * leap;
  const first = range ? range.start : 1;
  const count = range ? mod(range.end - range.start, nailCount) + 1 : nailCount;
  const chords = [];
  for (let k = 0; k < count; k++) {
    const thread = mod(first - 1 + k, nailCount) + 1;
    const j = thread % nailCount;
    const fromIndex = mod(start + j, nailCount);
    const toIndex = mod(start + multiplier * j, nailCount);
    if (fromIndex === toIndex) continue;
    chords.push({ fromIndex, toIndex, thread, single: false });
  }
  if (chords.length > 0) chords[chords.length - 1].single = true;
  return chords;
}

/**
 * Every chord of every layer of a run stack. Hidden runs (`enabled: false`)
 * are skipped and leave no gap in the stack.
 * @param {{
 *   nailCount:number, layerCount:number, leap:number, multiplier:number,
 *   runs: {color:string, enabled:boolean, rangeStart:number, rangeEnd:number, rotation:number, multiplier:number|null, leap:number|null}[],
 * }} params a run's `multiplier`/`leap` of null means the shared one
 * @returns {{fromIndex:number, toIndex:number, color:string, layerIndex:number, stackIndex:number, runIndex:number, single:boolean}[]}
 */
export function stackChords({ nailCount, layerCount, leap, multiplier, runs }) {
  const chords = [];
  for (let layerIndex = 0; layerIndex < layerCount; layerIndex++) {
    let stackIndex = 0;
    runs.forEach((run, runIndex) => {
      if (!run.enabled) return;
      for (const chord of runChords({
        nailCount,
        multiplier: run.multiplier ?? multiplier,
        leap: run.leap ?? leap,
        layerIndex,
        rotation: run.rotation,
        range: { start: run.rangeStart, end: run.rangeEnd },
      })) {
        chords.push({ fromIndex: chord.fromIndex, toIndex: chord.toIndex, color: run.color, layerIndex, stackIndex, runIndex, single: chord.single });
      }
      stackIndex++;
    });
  }
  return chords;
}

/** How many runs are drawn (enabled) - the height of one layer's stack. */
export function stackDepth(runs) {
  return runs.filter((r) => r.enabled).length;
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

