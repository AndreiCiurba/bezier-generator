import { Panel } from '../ui/Panel.js';
import { parseGridSize, GRID_SIZE_PRESETS, MIN_GRID_SIZE, MAX_GRID_SIZE } from './gridSize.js';

/**
 * Wires the "Grid Size" submenu: a preset dropdown of common square sizes
 * (applies immediately on selection) plus a custom N field + Apply for
 * anything else - mirrors freestyle's `CanvasSizeUI` shape exactly. The
 * lattice here is always square (N x N nails), not the 2D grid tool's fixed
 * 15x13 rectangle.
 */
export class GridSizeUI {
  /**
   * @param {{panelEl: HTMLElement, openBtn: HTMLElement, closeBtn: HTMLElement, presetSelect: HTMLSelectElement, customInput: HTMLInputElement, applyBtn: HTMLElement}} elements
   * @param {import('../ui/PanelGroup.js').PanelGroup} submenuGroup
   * @param {number} initialSize
   * @param {(size: number) => void} onApply
   */
  constructor(elements, submenuGroup, initialSize, onApply) {
    this.el = elements;
    this.panel = submenuGroup.register(new Panel(elements.panelEl));
    this.submenuGroup = submenuGroup;
    this.size = initialSize;
    this.onApply = onApply;
  }

  init() {
    const { openBtn, closeBtn, presetSelect, customInput, applyBtn } = this.el;

    openBtn.addEventListener('click', () => this.submenuGroup.openOnly(this.panel));
    closeBtn.addEventListener('click', () => this.panel.close());

    presetSelect.innerHTML = '<option value="">Custom…</option>';
    GRID_SIZE_PRESETS.forEach((n) => {
      const option = document.createElement('option');
      option.value = String(n);
      option.textContent = `${n} × ${n}`;
      presetSelect.appendChild(option);
    });
    this.#reflectSize();

    presetSelect.addEventListener('change', () => {
      if (presetSelect.value === '') return;
      this.#apply(presetSelect.value);
    });
    applyBtn.addEventListener('click', () => this.#apply(customInput.value));
  }

  #reflectSize() {
    const { presetSelect, customInput } = this.el;
    customInput.value = String(this.size);
    presetSelect.value = GRID_SIZE_PRESETS.includes(this.size) ? String(this.size) : '';
  }

  #apply(rawValue) {
    const parsed = parseGridSize(rawValue);
    if (parsed === null) {
      alert(`Enter a grid size between ${MIN_GRID_SIZE} and ${MAX_GRID_SIZE}.`);
      return;
    }
    this.size = parsed;
    this.#reflectSize();
    this.onApply(parsed);
  }
}
