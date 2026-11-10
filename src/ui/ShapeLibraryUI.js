import { Panel } from './Panel.js';
import { downloadJson, readJsonFile } from '../io/JsonFile.js';
import { FreeformShape } from '../models/FreeformShape.js';

/**
 * Wires the Shape Designer's "Library" submenu: the list of committed
 * `FreeformShape`s (each renamable in place and deletable), plus export/
 * import of the whole library as JSON - modeled directly on `PatternUI`'s
 * saved-pattern list, re-rendering reactively via `ShapeLibraryStore#onChange`
 * the same way `CurvesUI` does for `CurveStore`.
 */
export class ShapeLibraryUI {
  /**
   * @param {{
   *   panelEl: HTMLElement, openBtn: HTMLElement, closeBtn: HTMLElement,
   *   listEl: HTMLElement, exportBtn: HTMLElement,
   *   importBtn: HTMLElement, importInput: HTMLInputElement,
   * }} elements
   * @param {import('../state/ShapeLibraryStore.js').ShapeLibraryStore} library
   * @param {import('./PanelGroup.js').PanelGroup} submenuGroup
   */
  constructor(elements, library, submenuGroup) {
    this.el = elements;
    this.panel = submenuGroup.register(new Panel(elements.panelEl));
    this.library = library;
    this.submenuGroup = submenuGroup;
  }

  init() {
    const { openBtn, closeBtn, exportBtn, importBtn, importInput } = this.el;

    openBtn.addEventListener('click', () => this.submenuGroup.toggleOpen(this.panel));
    closeBtn.addEventListener('click', () => this.panel.close());

    exportBtn.addEventListener('click', () => {
      downloadJson(this.library.shapes.map((s) => s.toJSON()), 'shapes.json', 2);
    });

    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = await readJsonFile(file);
        if (Array.isArray(data)) this.library.importShapes(data, FreeformShape);
      } catch (err) {
        alert('Invalid shape library file.');
        console.error(err);
      }
      importInput.value = '';
    });

    this.library.onChange(() => this.render());
    this.render();
  }

  render() {
    const list = this.el.listEl;
    list.innerHTML = '';

    for (const shape of this.library.shapes) {
      const li = document.createElement('li');
      li.style.marginBottom = '6px';
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      li.style.gap = '4px';

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = shape.name;
      nameInput.style.flex = '1';
      nameInput.addEventListener('change', () => {
        this.library.rename(shape.id, nameInput.value.trim() || shape.name);
      });

      const summary = document.createElement('span');
      summary.style.fontSize = '10px';
      summary.style.color = 'var(--panel-text-muted)';
      const heightNote = shape.height === null ? 'global height' : `h=${shape.height}`;
      const weightNote = shape.weight === null ? 'global weight' : `w=${shape.weight}`;
      summary.textContent = `nails=${shape.nailCount}, leap=${shape.leap}, colors=${shape.colors.length}, ${heightNote}, ${weightNote}`;

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'menu-btn';
      deleteBtn.textContent = '×';
      deleteBtn.style.width = 'auto';
      deleteBtn.style.padding = '2px 8px';
      deleteBtn.addEventListener('click', () => this.library.remove(shape.id));

      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.flexDirection = 'column';
      row.style.flex = '1';
      row.appendChild(nameInput);
      row.appendChild(summary);

      li.appendChild(row);
      li.appendChild(deleteBtn);
      list.appendChild(li);
    }

    if (this.library.count === 0) {
      const li = document.createElement('li');
      li.textContent = 'No shapes saved yet.';
      li.style.color = 'var(--panel-text-muted, #888)';
      list.appendChild(li);
    }
  }
}
