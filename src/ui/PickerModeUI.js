import { getPickerMode, setPickerMode } from '../state/pickerMode.js';

/**
 * Wires the "Default | Custom" picker-mode toggle (see pickerMode.js) to a
 * ColorPickerUI: clicking either button persists the mode, then rebuilds
 * the color swatches so they immediately switch between native
 * `<input type="color">`s and the categorized custom-palette swatches.
 * Switching modes never touches palette colors themselves - only which
 * control opens.
 */
export class PickerModeUI {
  /**
   * @param {{defaultBtn: HTMLElement, customBtn: HTMLElement}} elements
   * @param {import('./ColorPickerUI.js').ColorPickerUI} colorPickerUI rebuilt after every mode change
   */
  constructor(elements, colorPickerUI) {
    this.el = elements;
    this.colorPickerUI = colorPickerUI;
  }

  init() {
    this.el.defaultBtn.addEventListener('click', () => this.#setMode('default'));
    this.el.customBtn.addEventListener('click', () => this.#setMode('custom'));
    this.#render();
  }

  #setMode(mode) {
    if (getPickerMode() === mode) return;
    setPickerMode(mode);
    this.colorPickerUI.rebuild();
    this.#render();
  }

  #render() {
    const mode = getPickerMode();
    this.el.defaultBtn.classList.toggle('picker-mode-active', mode === 'default');
    this.el.customBtn.classList.toggle('picker-mode-active', mode === 'custom');
  }
}
