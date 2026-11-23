import { runPreview } from '../core/cardioidWeave.js';

/**
 * The Cardioid page's "Runs" list: one card per run of the stack, in stack
 * order (first = lowest, strung first). Each card has show/color, its point 0
 * (the board nail its threads count from), its thread range, and its own
 * multiplier and leap (blank = the shared ones), plus buttons to move it
 * lower/higher, copy or delete it, and a line showing the first and last
 * connection it strings in board nail numbers (e.g. 25-26 ... 48-24).
 *
 * Holds no state: every edit goes straight to the `CardioidRunStore`. The
 * list is redrawn on every store change except edits typed into its own
 * fields, so tabbing between fields keeps focus.
 */
export class CardioidRunsUI {
  #fromField = false;

  /**
   * @param {HTMLElement} container
   * @param {import('../state/CardioidRunStore.js').CardioidRunStore} store
   * @param {() => {nailCount:number, multiplier:number}} getShared the page's nail count and shared multiplier
   */
  constructor(container, store, getShared) {
    this.container = container;
    this.store = store;
    this.getShared = getShared;
    this.previews = [];
  }

  init() {
    this.store.onChange(() => {
      if (!this.#fromField) this.render();
    });
    this.render();
  }

  render() {
    this.container.innerHTML = '';
    this.previews = [];
    const runs = this.store.runs;
    runs.forEach((run, index) => this.container.appendChild(this.#card(run, index, runs.length)));
    if (runs.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No runs - add one to weave.';
      empty.style.cssText = 'font-size:10px; color: var(--panel-text-muted, #888); margin-top: 4px;';
      this.container.appendChild(empty);
    }
  }

  #card(run, index, count) {
    const card = document.createElement('div');
    card.style.cssText = 'border: 1px solid var(--panel-border, #444); border-radius: 4px; padding: 4px 6px; margin-top: 6px;'
      + (run.enabled ? '' : ' opacity: 0.55;');

    const head = row();
    const show = document.createElement('input');
    show.type = 'checkbox';
    show.checked = run.enabled;
    show.title = 'Show this run';
    show.addEventListener('change', () => this.store.update(index, { enabled: show.checked })); // redraws: card dims

    const color = document.createElement('input');
    color.type = 'color';
    color.value = run.color;
    color.title = 'Run color';
    color.style.cssText = 'width: 28px; height: 20px; padding: 0; border: none; background: none;';
    color.addEventListener('input', () => this.#edit(index, { color: color.value }));

    const title = document.createElement('span');
    title.style.cssText = 'flex: 1; font-size: 11px; color: var(--panel-text);';
    title.textContent = `Run ${index + 1}${count > 1 && index === 0 ? ' (bottom)' : ''}${count > 1 && index === count - 1 ? ' (top)' : ''}`;

    head.append(
      show, color, title,
      button('↑', 'Move lower in the stack (strung earlier)', index === 0, () => this.store.move(index, -1)),
      button('↓', 'Move higher in the stack (strung later)', index === count - 1, () => this.store.move(index, 1)),
      button('⧉', 'Copy this run', false, () => this.store.duplicate(index)),
      button('×', 'Delete this run', false, () => this.store.remove(index)),
    );

    const { nailCount } = this.getShared();
    const start = row();
    start.append(
      label('Point 0 at nail'),
      this.#intField(run.rotation, { min: 0, max: nailCount - 1 }, (v) => ({ rotation: v }), index,
        'The board nail this run counts from: its thread j joins nail (point 0 + j) to nail (point 0 + multiplier x j). '
        + 'E.g. with 48 nails, point 0 = 24 makes thread 1 join 25-26: the cardioid turned 180 degrees.'),
    );

    const threads = row();
    threads.append(
      label('Threads'),
      this.#intField(run.rangeStart, { min: 1, max: nailCount }, (v) => ({ rangeStart: v }), index, 'First thread of the run, counted from its point 0'),
      label('–'),
      this.#intField(run.rangeEnd, { min: 1, max: nailCount }, (v) => ({ rangeEnd: v }), index, 'Last thread of the run - strung one way only. Before the first = wraps past the last nail.'),
    );

    const overrides = row();
    overrides.append(
      label('Mult.'),
      this.#intField(run.multiplier, { min: 1, max: 100, optional: true }, (v) => ({ multiplier: v }), index, 'Own multiplier (2 cardioid, 3 nephroid, ...). Blank = the shared one.'),
      label('Leap'),
      this.#intField(run.leap, { min: 0, max: 1000, optional: true }, (v) => ({ leap: v }), index, 'Own leap between layers. Blank = the shared one.'),
    );

    const preview = document.createElement('div');
    preview.style.cssText = 'font-size: 10px; color: var(--panel-text-muted, #888); margin-top: 3px;';
    this.previews[index] = preview;
    this.#showPreview(index);

    card.append(head, start, threads, overrides, preview);
    return card;
  }

  /** Refreshes each card's "Strings 25-26 ... 48-24" line, e.g. after the shared multiplier changes. */
  refreshPreviews() {
    this.previews.forEach((_, index) => this.#showPreview(index));
  }

  #showPreview(index) {
    const element = this.previews[index];
    const run = this.store.runs[index];
    if (!element || !run) return;
    const { nailCount, multiplier } = this.getShared();
    const preview = runPreview({
      nailCount, multiplier: run.multiplier ?? multiplier, rotation: run.rotation, range: { start: run.rangeStart, end: run.rangeEnd },
    });
    element.textContent = preview
      ? `Strings ${preview.first} … ${preview.last} (${preview.count} threads)`
      : 'Strings nothing (every thread joins a nail to itself).';
  }

  /** A whole-number field; anything out of range snaps back. `optional` fields may be left blank (= null, the shared value). */
  #intField(value, { min, max, optional = false }, toChanges, index, title) {
    const input = document.createElement('input');
    input.type = 'number';
    input.step = '1';
    input.min = String(min);
    input.max = String(max);
    input.title = title;
    input.style.cssText = 'width: 100%; min-width: 0;';
    if (optional) input.placeholder = 'shared';
    input.value = value === null ? '' : String(value);
    input.addEventListener('change', () => {
      const text = input.value.trim();
      if (optional && text === '') {
        this.#edit(index, toChanges(null));
        return;
      }
      const number = Number(text);
      if (text === '' || !Number.isInteger(number) || number < min || number > max) {
        input.value = value === null ? '' : String(value);
        return;
      }
      value = number;
      this.#edit(index, toChanges(number));
    });
    return input;
  }

  #edit(index, changes) {
    this.#fromField = true;
    try {
      this.store.update(index, changes);
    } finally {
      this.#fromField = false;
    }
    this.#showPreview(index);
  }
}

function row() {
  const div = document.createElement('div');
  div.style.cssText = 'display: flex; align-items: center; gap: 4px; margin-top: 3px;';
  return div;
}

function label(text) {
  const span = document.createElement('span');
  span.textContent = text;
  span.style.cssText = 'font-size: 10px; color: var(--panel-text); white-space: nowrap;';
  return span;
}

function button(text, title, disabled, onClick) {
  const b = document.createElement('button');
  b.className = 'menu-btn';
  b.textContent = text;
  b.title = title;
  b.disabled = disabled;
  b.style.cssText = 'width: auto; padding: 1px 6px; margin: 0;';
  b.addEventListener('click', onClick);
  return b;
}
