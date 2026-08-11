import { Panel } from './Panel.js';
import { downloadJson, readJsonFile } from '../io/JsonFile.js';
import { Pattern } from '../models/Pattern.js';
import { generateId } from '../utils/id.js';

/**
 * Wires the "Patterns" submenu: saving the current selection as a named
 * pattern, exporting/importing patterns, the Manual/Auto placement toggle,
 * and the saved-pattern list (select-to-arm, hover-to-preview).
 */
export class PatternUI {
  /**
   * @param {{
   *   panelEl: HTMLElement, openBtn: HTMLElement, closeBtn: HTMLElement,
   *   exportBtn: HTMLElement, importBtn: HTMLElement, importInput: HTMLInputElement,
   *   saveBtn: HTMLElement, nameInput: HTMLInputElement, listEl: HTMLElement,
   *   toggleModeBtn: HTMLElement,
   * }} elements
   * @param {import('../state/PatternStore.js').PatternStore} patternStore
   * @param {import('../state/SelectionStore.js').SelectionStore} selection
   * @param {import('../state/StrokePalette.js').StrokePalette} palette
   * @param {import('./PatternStamper.js').PatternStamper} stamper
   * @param {import('./PanelGroup.js').PanelGroup} submenuGroup keeps this and the Colors submenu mutually exclusive
   * @param {(patternId: string) => void} [onPatternSaved] called with the new
   *   pattern's id right after saving - lets the caller tag the still-
   *   uncommitted selection as this pattern's origin, so if/when it's
   *   committed to a curve, it can share the pattern's id too (see
   *   FreestyleApp's ctrl-shift point editor: this is what makes the
   *   original hand-drawn shape move along with the pattern's stamped
   *   copies, not just the copies). Optional - the grid tool doesn't wire it.
   *
   * `elements.toggleModeBtn` is optional - omit it where there's no grid to
   * auto-stamp across (the freestyle page), and Manual/Auto placement simply
   * doesn't apply.
   */
  constructor(elements, patternStore, selection, palette, stamper, submenuGroup, onPatternSaved) {
    this.el = elements;
    this.panel = submenuGroup.register(new Panel(elements.panelEl));
    this.patternStore = patternStore;
    this.selection = selection;
    this.palette = palette;
    this.stamper = stamper;
    this.submenuGroup = submenuGroup;
    this.onPatternSaved = onPatternSaved;
    this.listItems = new Map(); // pattern id -> <li>
  }

  init() {
    const { openBtn, closeBtn, exportBtn, importBtn, importInput, saveBtn, toggleModeBtn } = this.el;

    openBtn.addEventListener('click', () => this.submenuGroup.openOnly(this.panel));
    closeBtn.addEventListener('click', () => this.panel.close());

    exportBtn.addEventListener('click', () => {
      downloadJson(this.patternStore.patterns.map((p) => p.toJSON()), 'patterns.json', 2);
    });

    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = await readJsonFile(file);
        if (Array.isArray(data)) {
          this.patternStore.importPatterns(data, Pattern);
          this.render();
        }
      } catch (err) {
        alert('Invalid pattern file.');
        console.error(err);
      }
    });

    if (toggleModeBtn) {
      toggleModeBtn.addEventListener('click', () => {
        const mode = this.patternStore.togglePlacementMode();
        toggleModeBtn.textContent = mode === 'manual' ? 'Manual' : 'Auto';
      });
    }

    saveBtn.addEventListener('click', () => this.#saveCurrentSelection());

    this.render();
  }

  #saveCurrentSelection() {
    const name = this.el.nameInput.value.trim();
    if (!name) {
      alert('Please enter a name for the pattern.');
      return;
    }
    if (!this.selection.isReadyForCurve()) {
      alert('At least 3 points required.');
      return;
    }

    const pattern = new Pattern({
      id: generateId(),
      name,
      points: this.selection.points,
      colors: this.palette.snapshot(),
    });
    this.patternStore.add(pattern);
    this.onPatternSaved?.(pattern.id);
    this.render();
    this.el.nameInput.value = '';
  }

  render() {
    const list = this.el.listEl;
    list.innerHTML = '';
    this.listItems.clear();

    for (const pattern of this.patternStore.patterns) {
      const li = document.createElement('li');
      li.textContent = pattern.name;
      li.style.cursor = 'pointer';
      li.style.marginBottom = '4px';

      li.addEventListener('click', () => this.#selectPattern(pattern, li));
      li.addEventListener('mousemove', () => {
        this.patternStore.setPreview(pattern, { x: mouseX, y: mouseY });
      });
      li.addEventListener('mouseleave', () => this.patternStore.clearPreview());

      this.listItems.set(pattern.id, li);
      list.appendChild(li);
    }
  }

  #selectPattern(pattern, li) {
    this.resetSelectionVisual();
    li.style.borderStyle = 'solid';

    this.patternStore.select(pattern.id, true);
    if (this.patternStore.placementMode === 'auto') {
      this.stamper.stampThroughoutGrid();
    }
  }

  /** Clears the selected-pattern highlight from the list (no state change). */
  resetSelectionVisual() {
    for (const li of this.listItems.values()) {
      li.style.border = 'none';
    }
  }
}
