import { parseNailHeight, MIN_NAIL_HEIGHT, MAX_NAIL_HEIGHT } from './nailHeight.js';

/**
 * Wires the "Nail Height" field - mirrors `StrokeWeightUI`'s field+Apply
 * shape exactly (explicit confirmation, not a live-as-you-type drag, since
 * this reshapes every nail *and* every curve's Z-layer range at once).
 */
export class NailHeightUI {
  /**
   * @param {{input: HTMLInputElement, applyBtn: HTMLElement}} elements
   * @param {number} initialHeight
   * @param {(height: number) => void} onApply
   */
  constructor(elements, initialHeight, onApply) {
    this.el = elements;
    this.height = initialHeight;
    this.onApply = onApply;
  }

  init() {
    this.el.input.value = String(this.height);
    this.el.applyBtn.addEventListener('click', () => this.#apply());
  }

  #apply() {
    const parsed = parseNailHeight(this.el.input.value);
    if (parsed === null) {
      alert(`Enter a nail height between ${MIN_NAIL_HEIGHT} and ${MAX_NAIL_HEIGHT}.`);
      return;
    }
    this.height = parsed;
    this.el.input.value = String(parsed);
    this.onApply(parsed);
  }
}
