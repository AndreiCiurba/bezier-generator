import { Panel } from '../ui/Panel.js';
import { parseToPixels } from './units.js';

/** Common physical board sizes, in cm. */
export const SIZE_PRESETS_CM = [
  { label: '20 × 20 cm', widthCm: 20, heightCm: 20 },
  { label: '30 × 30 cm', widthCm: 30, heightCm: 30 },
  { label: '30 × 40 cm', widthCm: 30, heightCm: 40 },
  { label: '40 × 40 cm', widthCm: 40, heightCm: 40 },
  { label: '50 × 50 cm', widthCm: 50, heightCm: 50 },
];

/**
 * Wires the "Canvas Size" submenu: a preset dropdown (applies immediately)
 * and custom width/height fields that accept a unit ("20cm", "600px", or a
 * bare number defaulting to px) plus a DPI field controlling the unit->pixel
 * ratio, applied via an explicit button.
 */
export class CanvasSizeUI {
  /**
   * @param {{
   *   panelEl: HTMLElement, openBtn: HTMLElement, closeBtn: HTMLElement,
   *   presetSelect: HTMLSelectElement, widthInput: HTMLInputElement,
   *   heightInput: HTMLInputElement, dpiInput: HTMLInputElement, applyBtn: HTMLElement,
   * }} elements
   * @param {{widthPx: number, heightPx: number, dpi: number}} initial
   * @param {(widthPx: number, heightPx: number, dpi: number) => void} onApply
   * @param {import('../ui/PanelGroup.js').PanelGroup} submenuGroup
   */
  constructor(elements, initial, onApply, submenuGroup) {
    this.el = elements;
    this.panel = submenuGroup.register(new Panel(elements.panelEl));
    this.submenuGroup = submenuGroup;
    this.onApply = onApply;
    this.dpi = initial.dpi;
    this.widthPx = initial.widthPx;
    this.heightPx = initial.heightPx;
  }

  init() {
    const { openBtn, closeBtn, presetSelect, widthInput, heightInput, dpiInput, applyBtn } = this.el;

    openBtn.addEventListener('click', () => this.submenuGroup.toggleOpen(this.panel));
    closeBtn.addEventListener('click', () => this.panel.close());

    presetSelect.innerHTML = '<option value="">Custom…</option>';
    SIZE_PRESETS_CM.forEach((preset, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = preset.label;
      presetSelect.appendChild(option);
    });

    presetSelect.addEventListener('change', () => {
      if (presetSelect.value === '') return;
      const preset = SIZE_PRESETS_CM[Number(presetSelect.value)];
      widthInput.value = `${preset.widthCm}cm`;
      heightInput.value = `${preset.heightCm}cm`;
      this.#apply();
    });

    applyBtn.addEventListener('click', () => this.#apply());

    dpiInput.value = String(this.dpi);
    widthInput.value = `${this.widthPx}px`;
    heightInput.value = `${this.heightPx}px`;
  }

  #apply() {
    const { widthInput, heightInput, dpiInput, presetSelect } = this.el;

    const dpi = parseFloat(dpiInput.value);
    const resolvedDpi = Number.isFinite(dpi) && dpi > 0 ? dpi : this.dpi;

    const widthPx = parseToPixels(widthInput.value, resolvedDpi);
    const heightPx = parseToPixels(heightInput.value, resolvedDpi);
    if (!widthPx || !heightPx) {
      alert('Enter a valid size, e.g. "20cm" or "600px".');
      return;
    }

    this.dpi = resolvedDpi;
    this.widthPx = widthPx;
    this.heightPx = heightPx;
    presetSelect.value = '';
    this.onApply(widthPx, heightPx, resolvedDpi);
  }
}
