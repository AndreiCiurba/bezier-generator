import { Panel } from './Panel.js';

/**
 * Wires the "Curves" submenu: a list of every committed curve, in draw
 * (Z-layer) order, each with a checkbox to show/hide it - the shared
 * curve-visibility feature the 3D visualizer's "Z-Layer Visualization"
 * integrates with, so a hidden curve disappears from both the 2D canvas and
 * the 3D scene, not just one or the other.
 *
 * Modeled directly on `PatternUI`'s saved-pattern list (`Map<id, <li>>`,
 * rebuild-on-change `render()`), but reads/writes `CurveStore` instead of
 * `PatternStore`, and re-renders reactively via `CurveStore#onChange` rather
 * than requiring every caller to remember to call `render()` themselves.
 */
export class CurvesUI {
  /**
   * @param {{panelEl: HTMLElement, openBtn: HTMLElement, closeBtn: HTMLElement, listEl: HTMLElement}} elements
   * @param {import('../state/CurveStore.js').CurveStore} curveStore
   * @param {import('./PanelGroup.js').PanelGroup} submenuGroup keeps this mutually exclusive with the other submenus anchored at the same spot
   */
  constructor(elements, curveStore, submenuGroup) {
    this.el = elements;
    this.panel = submenuGroup.register(new Panel(elements.panelEl));
    this.curveStore = curveStore;
    this.submenuGroup = submenuGroup;
    this.listItems = new Map(); // curve id -> <li>
  }

  init() {
    const { openBtn, closeBtn } = this.el;
    openBtn.addEventListener('click', () => this.submenuGroup.toggleOpen(this.panel));
    closeBtn.addEventListener('click', () => this.panel.close());

    this.curveStore.onChange(() => this.render());
    this.render();
  }

  render() {
    const list = this.el.listEl;
    list.innerHTML = '';
    this.listItems.clear();

    this.curveStore.curves.forEach((curve, index) => {
      const li = document.createElement('li');
      li.style.marginBottom = '4px';

      const label = document.createElement('label');
      label.style.display = 'flex';
      label.style.alignItems = 'center';
      label.style.gap = '4px';
      label.style.cursor = 'pointer';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = curve.visible;
      checkbox.addEventListener('change', () => {
        this.curveStore.setVisible(curve.id, checkbox.checked);
      });

      const text = document.createElement('span');
      text.textContent = `Curve ${index + 1}`;

      label.appendChild(checkbox);
      label.appendChild(text);
      li.appendChild(label);

      this.listItems.set(curve.id, li);
      list.appendChild(li);
    });

    if (this.curveStore.count === 0) {
      const li = document.createElement('li');
      li.textContent = 'No curves yet.';
      li.style.color = 'var(--panel-text-muted, #888)';
      list.appendChild(li);
    }
  }
}
