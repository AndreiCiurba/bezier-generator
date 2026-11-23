import { threadInRange } from '../core/cardioidWeave.js';

/**
 * One run of a cardioid's stack (see `core/cardioidWeave.js`): like its own
 * pass of the times table, with its own start nail (`rotation`), thread
 * range, color and - when not null - its own multiplier and leap.
 * @typedef {{color:string, enabled:boolean, rangeStart:number, rangeEnd:number, rotation:number, multiplier:number|null, leap:number|null}} CardioidRun
 */

// Colors handed to new runs in turn, so stacked runs are told apart at a glance.
export const RUN_COLORS = ['#e63946', '#ffffff', '#f4a261', '#2a9d8f', '#457b9d', '#e9c46a', '#8338ec', '#06d6a0'];

/** Gap between two stacked runs of one layer: one thread lies on the other. */
export const DEFAULT_RUN_GAP_MM = 0.5;

/** A run over every thread, unturned, using the shared multiplier and leap. */
export function defaultRun(nailCount, color = RUN_COLORS[0]) {
  return { color, enabled: true, rangeStart: 1, rangeEnd: nailCount, rotation: 0, multiplier: null, leap: null };
}

const intIn = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

/**
 * A saved/typed run with every field made valid: thread numbers inside
 * 1 .. nailCount, an override of anything but a whole number meaning "shared".
 * @returns {CardioidRun}
 */
export function normalizeRun(raw, nailCount) {
  const clampThread = (value, fallback) => (Number.isInteger(value) ? Math.min(Math.max(value, 1), nailCount) : fallback);
  return {
    color: typeof raw?.color === 'string' ? raw.color : RUN_COLORS[0],
    enabled: raw?.enabled !== false,
    rangeStart: clampThread(raw?.rangeStart, 1),
    rangeEnd: clampThread(raw?.rangeEnd, nailCount),
    rotation: Number.isInteger(raw?.rotation) ? raw.rotation : 0,
    multiplier: intIn(raw?.multiplier, 1, 100) ? raw.multiplier : null,
    leap: intIn(raw?.leap, 0, 1000) ? raw.leap : null,
  };
}

/** After the nail count changes: a run over every thread stays over every thread; a part run is clipped to the new count. */
export function fitRunToNailCount(run, previousNailCount, nailCount) {
  const wasFull = run.rangeStart === 1 && run.rangeEnd === previousNailCount;
  return {
    ...run,
    rangeStart: Math.min(run.rangeStart, nailCount),
    rangeEnd: wasFull ? nailCount : Math.min(run.rangeEnd, nailCount),
  };
}

/**
 * Runs that weave exactly like a cardioid saved before runs existed, when
 * each layer was split into equal color arcs (thread `j` got enabled color
 * `floor(j * colors / nailCount)`) and only threads `rangeStart..rangeEnd`
 * were drawn: one run per stretch of same-colored visible threads.
 * @param {{nailCount:number, colors?: {color:string, enabled:boolean}[], rangeStart?:number|null, rangeEnd?:number|null}} legacy
 * @returns {CardioidRun[]}
 */
export function runsFromLegacy({ nailCount, colors = [], rangeStart = null, rangeEnd = null }) {
  const enabled = colors.filter((c) => c.enabled).map((c) => c.color);
  if (enabled.length === 0) return [];
  const range = Number.isInteger(rangeStart) && Number.isInteger(rangeEnd) ? { start: rangeStart, end: rangeEnd } : null;
  const first = range ? range.start : 1;
  const runs = [];
  let current = null;
  for (let k = 0; k < nailCount; k++) {
    const thread = ((first - 1 + k) % nailCount) + 1;
    const j = thread % nailCount;
    if (j === 0) continue; // joins a nail to itself: never drawn
    if (!threadInRange(j, nailCount, range)) {
      current = null;
      continue;
    }
    const colorIndex = Math.min(enabled.length - 1, Math.floor((j * enabled.length) / nailCount));
    if (current && current.colorIndex === colorIndex) {
      current.run.rangeEnd = thread;
    } else {
      current = { colorIndex, run: { ...defaultRun(nailCount, enabled[colorIndex]), rangeStart: thread, rangeEnd: thread } };
      runs.push(current.run);
    }
  }
  return runs;
}
