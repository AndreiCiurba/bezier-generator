import { defaultRun, normalizeRun, fitRunToNailCount, RUN_COLORS } from '../models/cardioidRun.js';

/**
 * The Cardioid page's run stack: the runs every layer is woven from, in
 * stack order (index 0 lies against the layer below, each later run on top
 * of it). Same small pub-sub shape as the other `src/state/` stores.
 *
 * Thread ranges are linked: changing the threads of one run changes them on
 * every run that hasn't been given its own range (`ownRange`), so e.g.
 * "threads 1-24" applies to the whole stack at once.
 */
export class CardioidRunStore {
  #runs;
  #listeners = new Set();

  /** @param {number} nailCount */
  constructor(nailCount) {
    this.#runs = [defaultRun(nailCount)];
  }

  /** Copies, so callers can't change a run behind the store's back. */
  get runs() {
    return this.#runs.map((r) => ({ ...r }));
  }

  get count() {
    return this.#runs.length;
  }

  /** Replaces every run, e.g. when a saved cardioid is loaded. */
  setAll(runs, nailCount) {
    this.#runs = runs.map((r) => normalizeRun(r, nailCount));
    this.#notify();
  }

  /**
   * A new run on top: a copy of the top run in the next unused color, whose
   * point 0 is the nail where the top run ended - so it carries on round the
   * board instead of lying exactly on it (half a cardioid over threads 1-24
   * is followed by the same half from nail 24, turned 180 degrees). A full
   * run would end where it began, so its copy starts half way round.
   */
  add(nailCount) {
    const top = this.#runs.at(-1) ?? defaultRun(nailCount);
    const used = new Set(this.#runs.map((r) => r.color.toLowerCase()));
    const color = RUN_COLORS.find((c) => !used.has(c)) ?? RUN_COLORS[this.#runs.length % RUN_COLORS.length];
    const mod = (v) => ((v % nailCount) + nailCount) % nailCount;
    const span = mod(top.rangeEnd - top.rangeStart) + 1;
    const rotation = span === nailCount ? mod(top.rotation + Math.floor(nailCount / 2)) : mod(top.rotation + span);
    this.#runs.push({ ...top, color, enabled: true, rotation });
    this.#notify();
  }

  /** An exact copy of run `index`, placed right above it. */
  duplicate(index) {
    const run = this.#runs[index];
    if (!run) return;
    this.#runs.splice(index + 1, 0, { ...run });
    this.#notify();
  }

  remove(index) {
    if (!this.#runs[index]) return;
    this.#runs.splice(index, 1);
    this.#notify();
  }

  /** Moves run `index` by `delta` places in the stack (-1 = one lower / strung earlier). */
  move(index, delta) {
    const target = index + delta;
    if (!this.#runs[index] || target < 0 || target >= this.#runs.length) return;
    const [run] = this.#runs.splice(index, 1);
    this.#runs.splice(target, 0, run);
    this.#notify();
  }

  /** Changes run `index`; a thread range change also reaches every other linked run (see this class's doc). */
  update(index, changes) {
    const run = this.#runs[index];
    if (!run) return;
    Object.assign(run, changes);
    if (!run.ownRange && ('rangeStart' in changes || 'rangeEnd' in changes)) {
      for (const other of this.#runs) {
        if (other.ownRange) continue;
        other.rangeStart = run.rangeStart;
        other.rangeEnd = run.rangeEnd;
      }
    }
    this.#notify();
  }

  /**
   * Gives run `index` its own thread range (`own` true), or links it back to
   * the shared one - taking the range the other linked runs already have.
   */
  setOwnRange(index, own) {
    const run = this.#runs[index];
    if (!run) return;
    run.ownRange = own;
    if (!own) {
      const linked = this.#runs.find((r) => r !== run && !r.ownRange);
      if (linked) {
        run.rangeStart = linked.rangeStart;
        run.rangeEnd = linked.rangeEnd;
      }
    }
    this.#notify();
  }

  fitToNailCount(previousNailCount, nailCount) {
    this.#runs = this.#runs.map((r) => fitRunToNailCount(r, previousNailCount, nailCount));
    this.#notify();
  }

  onChange(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #notify() {
    for (const listener of this.#listeners) listener();
  }
}
