import { Panel } from '../ui/Panel.js';
import { parseGridSize, GRID_SIZE_PRESETS, MIN_GRID_SIZE, MAX_GRID_SIZE } from './gridSize.js';
import { GRID_SHAPES, GRID_SHAPE_LABELS } from './gridShape.js';

/**
 * Wires the "Grid Size" submenu: a preset dropdown of common square sizes
 * (applies immediately on selection) plus a custom N field + Apply for
 * anything else - mirrors freestyle's `CanvasSizeUI` shape exactly. Also
 * owns the "Grid Shape" selector (Triangle/Square/Hexagon - see
 * `gridShape.js`) since size and shape are always applied together,
 * funneled into one `onApply(size, shape)` callback. N is always the same
 * N x N rectangle for all three shapes (hexagon just has ~2/3 as many nails -
 * see `Grid.js#buildHexagon`; square has no row-parity stagger - see
 * `Grid.js#buildSquareTiled`) - not the 2D grid tool's fixed 15x13 rectangle
 * either way.
 */
export class GridSizeUI {
  /**
   * @param {{panelEl: HTMLElement, openBtn: HTMLElement, closeBtn: HTMLElement, presetSelect: HTMLSelectElement, customInput: HTMLInputElement, applyBtn: HTMLElement, shapeSelect: HTMLSelectElement}} elements
   * @param {import('../ui/PanelGroup.js').PanelGroup} submenuGroup
   * @param {number} initialSize
   * @param {string} initialShape
   * @param {(size: number, shape: string) => void} onApply
   */
  constructor(elements, submenuGroup, initialSize, initialShape, onApply) {
    this.el = elements;
    this.panel = submenuGroup.register(new Panel(elements.panelEl));
    this.submenuGroup = submenuGroup;
    this.size = initialSize;
    this.shape = initialShape;
    this.onApply = onApply;
  }

  init() {
    const { openBtn, closeBtn, presetSelect, customInput, applyBtn, shapeSelect } = this.el;

    openBtn.addEventListener('click', () => this.submenuGroup.toggleOpen(this.panel));
    closeBtn.addEventListener('click', () => this.panel.close());

    shapeSelect.innerHTML = '';
    GRID_SHAPES.forEach((shape) => {
      const option = document.createElement('option');
      option.value = shape;
      option.textContent = GRID_SHAPE_LABELS[shape];
      shapeSelect.appendChild(option);
    });
    shapeSelect.value = this.shape;
    shapeSelect.addEventListener('change', () => {
      this.shape = shapeSelect.value;
      this.onApply(this.size, this.shape);
    });

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
    this.onApply(this.size, this.shape);
  }
}
