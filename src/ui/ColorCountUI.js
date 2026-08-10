import { parseColorCount, MIN_COLORS, MAX_COLORS } from '../state/colorCount.js';

/**
 * Wires the "number of colors" field: how many stroke slots the palette has,
 * which (per the app's 1:1 coupling) is also the weave's subdivision count
 * and line weight - see App/FreestyleApp's draw loops, which derive both
 * from `colors.length` on each curve. Shared by the grid tool and freestyle.
 */
export class ColorCountUI {
  /**
   * @param {{input: HTMLInputElement, applyBtn: HTMLElement}} elements
   * @param {number} initialCount
   * @param {(count: number) => void} onApply
   */
  constructor(elements, initialCount, onApply) {
    this.el = elements;
    this.onApply = onApply;
    this.count = initialCount;
  }

  init() {
    this.el.input.value = String(this.count);
    this.el.applyBtn.addEventListener('click', () => this.#apply());
  }

  /** Updates the displayed count without triggering onApply - for when something else (e.g. applying a favorite color bundle) already resized the palette. */
  setCount(count) {
    this.count = count;
    this.el.input.value = String(count);
  }

  #apply() {
    const parsed = parseColorCount(this.el.input.value);
    if (parsed === null) {
      alert(`Enter a number of colors between ${MIN_COLORS} and ${MAX_COLORS}.`);
      return;
    }
    this.count = parsed;
    this.el.input.value = String(parsed);
    this.onApply(parsed);
  }
}
