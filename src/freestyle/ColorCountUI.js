import { parseColorCount, MIN_COLORS, MAX_COLORS } from './colorCount.js';

/**
 * Wires the "number of colors" field: how many stroke slots the palette has,
 * which (per the app's 1:1 coupling) is also the weave's subdivision count -
 * see FreestyleApp's draw loop, which always passes `colors.length` as the
 * segments argument.
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
