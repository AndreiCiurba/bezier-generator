import { parseBoardThickness, parseBoardColor, MIN_BOARD_THICKNESS, MAX_BOARD_THICKNESS } from './boardControls.js';

/**
 * Wires the "Board Thickness"/"Board Color" fields. Thickness mirrors
 * `StrokeWeightUI`'s field+Apply shape (explicit confirmation before a
 * geometry rebuild); color applies live on every `input` event - a native
 * `<input type="color">` already previews as you pick, so a separate Apply
 * button would only add friction, matching how `ColorPickerUI`'s swatches
 * apply live too.
 */
export class BoardControlsUI {
  /**
   * @param {{thicknessInput: HTMLInputElement, applyThicknessBtn: HTMLElement, colorInput: HTMLInputElement}} elements
   * @param {{thickness: number, color: string}} initial
   * @param {(thickness: number) => void} onThicknessChange
   * @param {(color: string) => void} onColorChange
   */
  constructor(elements, initial, onThicknessChange, onColorChange) {
    this.el = elements;
    this.thickness = initial.thickness;
    this.color = initial.color;
    this.onThicknessChange = onThicknessChange;
    this.onColorChange = onColorChange;
  }

  init() {
    this.el.thicknessInput.value = String(this.thickness);
    this.el.colorInput.value = this.color;

    this.el.applyThicknessBtn.addEventListener('click', () => this.#applyThickness());
    this.el.colorInput.addEventListener('input', () => this.#applyColor());
  }

  #applyThickness() {
    const parsed = parseBoardThickness(this.el.thicknessInput.value);
    if (parsed === null) {
      alert(`Enter a board thickness between ${MIN_BOARD_THICKNESS} and ${MAX_BOARD_THICKNESS}.`);
      return;
    }
    this.thickness = parsed;
    this.el.thicknessInput.value = String(parsed);
    this.onThicknessChange(parsed);
  }

  #applyColor() {
    const parsed = parseBoardColor(this.el.colorInput.value);
    if (parsed === null) return; // a native color input always yields a valid hex - defensive only
    this.color = parsed;
    this.onColorChange(parsed);
  }
}
