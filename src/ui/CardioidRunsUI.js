/**
 * The Cardioid page's "Runs" list: one card per run of the stack, in stack
 * order (first = lowest, strung first). Each card has show/color, its thread
 * range, its start nail (turn), and its own multiplier and leap (blank = the
 * shared ones), plus buttons to move it lower/higher, copy or delete it.
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
   * @param {() => number} getNailCount
   */
  constructor(container, store, getNailCount) {
    this.container = container;
    this.store = store;
    this.getNailCount = getNailCount;
  }

  init() {
    this.store.onChange(() => {
      if (!this.#fromField) this.render();
    });
    this.render();
  }

  render() {
    this.container.innerHTML = '';
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

    const nailCount = this.getNailCount();
    const threads = row();
    threads.append(
      label('Threads'),
      this.#intField(run.rangeStart, { min: 1, max: nailCount }, (v) => ({ rangeStart: v }), index, 'First thread of the run (thread j joins nail j to nail multiplier x j)'),
      label('–'),
      this.#intField(run.rangeEnd, { min: 1, max: nailCount }, (v) => ({ rangeEnd: v }), index, 'Last thread of the run - strung one way only. Before the first = wraps past the last nail.'),
      label('Turn'),
      this.#intField(run.rotation, { min: 0, max: 1000 }, (v) => ({ rotation: v }), index, 'Nails this run is turned by: it starts from this nail instead of nail 0.'),
    );

    const overrides = row();
    overrides.append(
      label('Mult.'),
      this.#intField(run.multiplier, { min: 1, max: 100, optional: true }, (v) => ({ multiplier: v }), index, 'Own multiplier (2 cardioid, 3 nephroid, ...). Blank = the shared one.'),
      label('Leap'),
      this.#intField(run.leap, { min: 0, max: 1000, optional: true }, (v) => ({ leap: v }), index, 'Own leap between layers. Blank = the shared one.'),
    );

    card.append(head, threads, overrides);
    return card;
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
