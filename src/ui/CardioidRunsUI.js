import { runPreview } from '../core/cardioidWeave.js';
import { CustomColorPopover } from './CustomColorPopover.js';

/**
 * The Cardioid page's "Runs" list: one card per run of the stack, in stack
 * order (first = lowest, strung first). Each card has show/color, its point 0
 * (the board nail its threads count from), its thread range, and its own
 * multiplier and leap (blank = the shared ones), plus buttons to move it
 * lower/higher, copy or delete it, and a line showing the first and last
 * connection it strings in board nail numbers (e.g. 25-26 ... 48-24).
 *
 * A run's color is picked from the custom thread palette (its swatch), or
 * from any color with the small native picker beside it. Its threads are
 * linked to every other run's unless "own" is ticked (see `CardioidRunStore`).
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
    this.rangeFields = []; // per card: its From/To inputs, kept in step with linked runs
    this.popover = new CustomColorPopover();
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
    this.rangeFields = [];
    this.popover.close();
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

    // Custom thread palette first; the native picker beside it for any other color.
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'color-btn';
    swatch.title = `Run color ${run.color} - pick from the thread palette`;
    swatch.style.cssText = `width: 22px; height: 22px; margin: 0; background-color: ${run.color};`;
    const anyColor = document.createElement('input');
    anyColor.type = 'color';
    anyColor.value = run.color;
    anyColor.title = 'Pick any color';
    anyColor.style.cssText = 'width: 16px; height: 16px; padding: 0; border: none; background: none;';
    const setColor = (hex) => {
      swatch.style.backgroundColor = hex;
      swatch.title = `Run color ${hex} - pick from the thread palette`;
      anyColor.value = hex;
      this.#edit(index, { color: hex });
    };
    swatch.addEventListener('click', () => this.popover.openFor(swatch, setColor));
    anyColor.addEventListener('input', () => setColor(anyColor.value));

    const title = document.createElement('span');
    title.style.cssText = 'flex: 1; font-size: 11px; color: var(--panel-text);';
    title.textContent = `Run ${index + 1}${count > 1 && index === 0 ? ' (bottom)' : ''}${count > 1 && index === count - 1 ? ' (top)' : ''}`;

    head.append(
      show, swatch, anyColor, title,
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
    const rangeStart = this.#intField(run.rangeStart, { min: 1, max: nailCount }, (v) => ({ rangeStart: v }), index, 'First thread of the run, counted from its point 0');
    const rangeEnd = this.#intField(run.rangeEnd, { min: 1, max: nailCount }, (v) => ({ rangeEnd: v }), index, 'Last thread of the run - strung one way only. Before the first = wraps past the last nail.');
    this.rangeFields[index] = { rangeStart, rangeEnd };
    const own = document.createElement('input');
    own.type = 'checkbox';
    own.checked = run.ownRange;
    own.title = "Own threads: changing this run's threads leaves the other runs alone (unticked = every linked run gets the same threads)";
    own.addEventListener('change', () => this.store.setOwnRange(index, own.checked)); // redraws
    const ownLabel = document.createElement('label');
    ownLabel.style.cssText = 'display: flex; align-items: center; gap: 2px; font-size: 10px; color: var(--panel-text); white-space: nowrap;';
    ownLabel.title = own.title;
    ownLabel.append(own, 'own');
    threads.append(label('Threads'), rangeStart, label('–'), rangeEnd, ownLabel);

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
        this.render(); // snaps back to what the store holds (a linked range may have moved since)
        return;
      }
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
    // A linked range change reaches other runs too: show it in their fields and previews.
    const runs = this.store.runs;
    this.rangeFields.forEach((fields, i) => {
      if (!fields || !runs[i]) return;
      fields.rangeStart.value = String(runs[i].rangeStart);
      fields.rangeEnd.value = String(runs[i].rangeEnd);
    });
    this.refreshPreviews();
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
