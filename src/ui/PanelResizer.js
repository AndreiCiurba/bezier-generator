import { upgradeCheckboxesToSwitches } from './SwitchUpgrade.js';

const MIN_WIDTH = 220; // px - labels and inputs still fit

/** Makes the main menu (`#ui`) and every submenu panel inside it drag-resizable. Call once after the menu's DOM exists. */
export function initPanelResizers() {
  upgradeCheckboxesToSwitches(); // menu look: 3D-style toggle switches
  const panels = document.querySelectorAll('#ui, #ui .panel');
  panels.forEach((panel) => new PanelResizer(panel).init());

  // Wheel over the menu scrolls the menu, never the canvas: p5 pages zoom/pan
  // from a window-level wheel listener, so stop the event before it gets
  // there. (Default scrolling is unaffected - only propagation is stopped.)
  const main = document.getElementById('ui');
  if (main) main.addEventListener('wheel', (event) => event.stopPropagation(), { passive: true });
}

/**
 * Drag-to-resize for a fixed side panel (the Arrange / Cardioid main menu and
 * its color-schemes flyout). It adds a thin drag strip along the panel's right
 * edge and writes the panel's inline `width`, capped at `maxFraction` of the
 * window so the board stays visible.
 *
 * The strip is a body-level `position: fixed` element rather than a child of
 * the panel: the panels scroll (`overflow-y: auto`), and an absolutely
 * positioned child would scroll away with their content. A ResizeObserver
 * keeps the strip glued to the panel as it resizes, opens or closes.
 */
export class PanelResizer {
  #panel;
  #maxFraction;
  #handle;
  #startX = 0;
  #startWidth = 0;

  /** @param {HTMLElement} panelEl @param {{maxFraction?: number}} [options] */
  constructor(panelEl, { maxFraction = 0.5 } = {}) {
    this.#panel = panelEl;
    this.#maxFraction = maxFraction;
  }

  init() {
    this.#handle = document.createElement('div');
    this.#handle.className = 'panel-resize-handle';
    this.#handle.hidden = true;
    document.body.appendChild(this.#handle);

    this.#handle.addEventListener('pointerdown', this.#handlePointerDown);
    const observer = new ResizeObserver(this.#syncHandle);
    observer.observe(this.#panel);
    // A submenu anchored to the main menu moves when the main menu resizes.
    const main = document.getElementById('ui');
    if (main && main !== this.#panel) observer.observe(main);
    // Opening a panel toggles its `hidden` class and moves a flyout, neither of
    // which changes its size - watch those too.
    new MutationObserver(this.#syncHandle).observe(this.#panel, { attributes: true, attributeFilter: ['class', 'style'] });
    window.addEventListener('resize', this.#syncHandle);
    this.#syncHandle();
  }

  #syncHandle = () => {
    const rect = this.#panel.getBoundingClientRect();
    const showing = rect.width > 0 && rect.height > 0;
    this.#handle.hidden = !showing;
    if (!showing) return;
    this.#handle.style.top = `${rect.top}px`;
    this.#handle.style.height = `${rect.height}px`;
    this.#handle.style.left = `${rect.right - 4}px`;
  };

  #handlePointerDown = (event) => {
    event.preventDefault();
    this.#startX = event.clientX;
    this.#startWidth = this.#panel.getBoundingClientRect().width;
    this.#handle.classList.add('resizing');
    this.#handle.setPointerCapture(event.pointerId);
    window.addEventListener('pointermove', this.#handlePointerMove);
    window.addEventListener('pointerup', this.#handlePointerUp);
  };

  #handlePointerMove = (event) => {
    const max = Math.max(MIN_WIDTH, window.innerWidth * this.#maxFraction);
    const width = Math.min(Math.max(this.#startWidth + (event.clientX - this.#startX), MIN_WIDTH), max);
    this.#panel.style.width = `${width}px`;
  };

  #handlePointerUp = () => {
    this.#handle.classList.remove('resizing');
    window.removeEventListener('pointermove', this.#handlePointerMove);
    window.removeEventListener('pointerup', this.#handlePointerUp);
  };
}
