import { parseStrokeWeight, MIN_STROKE_WEIGHT, MAX_STROKE_WEIGHT } from './strokeWeightSetting.js';

/**
 * Wires the "Stroke Weight" field: the pixel thickness new curves get woven
 * with, set directly instead of only derived from color count - so the
 * artist can match the actual thread they're using. Mirrors
 * `ColorCountUI`'s "field + Apply" shape exactly. Freestyle-only for now
 * (like `CanvasSizeUI`/`FreestylePatternStamper` started out) - move to
 * `src/ui/` if the grid tool ever wants manual weight control too.
 */
export class StrokeWeightUI {
  /**
   * @param {{input: HTMLInputElement, applyBtn: HTMLElement}} elements
   * @param {number} initialWeight
   * @param {(weight: number) => void} onApply
   */
  constructor(elements, initialWeight, onApply) {
    this.el = elements;
    this.onApply = onApply;
    this.weight = initialWeight;
  }

  init() {
    this.el.input.value = String(this.weight);
    this.el.applyBtn.addEventListener('click', () => this.#apply());
  }

  #apply() {
    const parsed = parseStrokeWeight(this.el.input.value);
    if (parsed === null) {
      alert(`Enter a stroke weight between ${MIN_STROKE_WEIGHT} and ${MAX_STROKE_WEIGHT}.`);
      return;
    }
    this.weight = parsed;
    this.el.input.value = String(parsed);
    this.onApply(parsed);
  }
}
