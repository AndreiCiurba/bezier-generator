import { defaultRun, normalizeRun, fitRunToNailCount, RUN_COLORS } from '../models/cardioidRun.js';

/**
 * The Cardioid page's run stack: the runs every layer is woven from, in
 * stack order (index 0 lies against the layer below, each later run on top
 * of it). Same small pub-sub shape as the other `src/state/` stores.
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

  /** A new run on top: a copy of the top run (so it continues its settings) in the next unused color. */
  add(nailCount) {
    const top = this.#runs.at(-1) ?? defaultRun(nailCount);
    const used = new Set(this.#runs.map((r) => r.color.toLowerCase()));
    const color = RUN_COLORS.find((c) => !used.has(c)) ?? RUN_COLORS[this.#runs.length % RUN_COLORS.length];
    this.#runs.push({ ...top, color, enabled: true });
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

  update(index, changes) {
    if (!this.#runs[index]) return;
    Object.assign(this.#runs[index], changes);
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
