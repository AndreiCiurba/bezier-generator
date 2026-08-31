import { Panel } from './Panel.js';
import { downloadJson, readJsonFile } from '../io/JsonFile.js';
import { WeaveRecipe } from '../models/WeaveRecipe.js';
import { generateId } from '../utils/id.js';
import { shapeNameForGridLayout, shapeNameForSides, sidesForGridLayout } from '../core/cellDetection.js';

/**
 * Wires the "Weave" submenu: N (inner nails per edge), leap, a Manual-mode
 * neighborhood-radius "brush size", the Manual/Auto placement toggle (same
 * shape as `PatternUI`'s), a "Populate All" button for Auto mode's bulk
 * action, a "Select All" button that live-selects every already-placed
 * weave cell at once (e.g. right after Populate All, so palette/N/leap
 * edits apply to the whole board while you dial them in - no need to
 * ctrl+click each cell one at a time), a "Reset" button that releases the
 * current live selection (see `WeaveState`), a read-only shape label kept in
 * sync with the grid's own current layout, and a "Saved Weaves" list - save
 * the current N/leap/color count under a name, export the whole list as
 * JSON, import a JSON file exported from the standalone playground
 * (`tools/leap-weave-playground.html`) - mirroring `PatternUI`'s save/
 * export/import flow, and `FavoritesUI`'s palette-resize-on-apply flow for
 * a recipe's color count/colors.
 *
 * Shared verbatim between the grid page and the 3D page, exactly like
 * `PatternUI`/`DeformationUI` already are - `App.js`/`ThreeApp.js` each own
 * the actual cell-detection/click-handling logic (mirroring how
 * `PatternStamper`, not `PatternUI`, owns stamping), and just read this
 * class's `isActive` to gate their own click dispatch.
 *
 * `isActive` (Weave Mode) is a real, independent flag - not derived from the
 * panel's open/closed state, the same reasoning `DeformationUI` already
 * documents for its own `isActive`.
 */
export class WeaveUI {
  #active = false;
  #currentLayout = null;

  /**
   * @param {{
   *   panelEl: HTMLElement, openBtn: HTMLElement, closeBtn: HTMLElement,
   *   shapeLabelEl: HTMLElement, nInput: HTMLInputElement, leapInput: HTMLInputElement,
   *   neighborRadiusInput: HTMLInputElement,
   *   toggleModeBtn: HTMLElement, populateAllBtn: HTMLElement, selectAllBtn: HTMLElement, resetBtn: HTMLElement,
   *   nameInput: HTMLInputElement, saveBtn: HTMLElement, listEl: HTMLElement,
   *   exportBtn: HTMLElement, importBtn: HTMLElement, importInput: HTMLInputElement,
   * }} elements
   * @param {import('../state/WeaveState.js').WeaveState} weaveState
   * @param {import('../state/StrokePalette.js').StrokePalette} palette
   * @param {import('./ColorPickerUI.js').ColorPickerUI} colorPickerUI
   * @param {import('./PanelGroup.js').PanelGroup} submenuGroup
   * @param {() => void} onPopulateAll called when "Populate All" is clicked
   *   (Auto mode's bulk action) - the caller owns the grid/cell-enumeration.
   * @param {() => void} onSelectAll called when "Select All" is clicked -
   *   the caller owns reading which cells are currently placed
   *   (`CurveStore#weaveCellIds`) and live-selecting all of them.
   * @param {(newSize: number) => void} onPaletteResize called right after a
   *   recipe's own color count resizes the palette, so e.g. `ColorCountUI`'s
   *   field can reflect the new size - same callback shape `FavoritesUI`
   *   already uses for the exact same reason.
   */
  constructor(elements, weaveState, palette, colorPickerUI, submenuGroup, onPopulateAll, onSelectAll, onPaletteResize) {
    this.el = elements;
    this.panel = submenuGroup.register(new Panel(elements.panelEl));
    this.weaveState = weaveState;
    this.palette = palette;
    this.colorPickerUI = colorPickerUI;
    this.submenuGroup = submenuGroup;
    this.onPopulateAll = onPopulateAll;
    this.onSelectAll = onSelectAll;
    this.onPaletteResize = onPaletteResize;
    this.listItems = new Map(); // recipe id -> <li>
  }

  get isActive() {
    return this.#active;
  }

  init() {
    const {
      openBtn,
      closeBtn,
      nInput,
      leapInput,
      neighborRadiusInput,
      toggleModeBtn,
      populateAllBtn,
      selectAllBtn,
      resetBtn,
      saveBtn,
      exportBtn,
      importBtn,
      importInput,
    } = this.el;

    openBtn.addEventListener('click', () => {
      if (this.panel.isOpen) {
        this.#active = false;
        this.panel.close();
      } else {
        this.#active = true;
        this.submenuGroup.openOnly(this.panel);
      }
    });
    closeBtn.addEventListener('click', () => {
      this.#active = false;
      this.panel.close();
    });

    nInput.value = String(this.weaveState.n);
    nInput.addEventListener('change', () => {
      const n = parseInt(nInput.value, 10);
      if (Number.isInteger(n) && n >= 0) this.weaveState.setN(n);
      else nInput.value = String(this.weaveState.n); // reject and restore, rather than leaving a bad value showing
    });

    leapInput.value = String(this.weaveState.leap);
    leapInput.addEventListener('change', () => {
      const leap = parseInt(leapInput.value, 10);
      if (Number.isInteger(leap)) this.weaveState.setLeap(leap);
      else leapInput.value = String(this.weaveState.leap);
    });

    neighborRadiusInput.value = String(this.weaveState.neighborRadius);
    neighborRadiusInput.addEventListener('change', () => {
      const radius = parseInt(neighborRadiusInput.value, 10);
      if (Number.isInteger(radius) && radius >= 0) this.weaveState.setNeighborRadius(radius);
      else neighborRadiusInput.value = String(this.weaveState.neighborRadius);
    });

    // Keeps the N/leap/neighborhood fields in sync no matter *what* changed
    // them - typing directly, loading a saved recipe below, or (on the 3D
    // page) an import merging new recipes in. Setting .value doesn't itself
    // fire a 'change' event, so this can't loop back into the listeners above.
    this.weaveState.onChange(() => {
      nInput.value = String(this.weaveState.n);
      leapInput.value = String(this.weaveState.leap);
      neighborRadiusInput.value = String(this.weaveState.neighborRadius);
    });

    toggleModeBtn.textContent = this.weaveState.placementMode === 'manual' ? 'Manual' : 'Auto';
    toggleModeBtn.addEventListener('click', () => {
      const mode = this.weaveState.togglePlacementMode();
      toggleModeBtn.textContent = mode === 'manual' ? 'Manual' : 'Auto';
    });

    populateAllBtn.addEventListener('click', () => this.onPopulateAll());
    selectAllBtn.addEventListener('click', () => this.onSelectAll());
    resetBtn.addEventListener('click', () => this.weaveState.reset());

    saveBtn.addEventListener('click', () => this.#saveCurrent());

    exportBtn.addEventListener('click', () => {
      downloadJson(this.weaveState.recipes.map((r) => r.toJSON()), 'weaves.json', 2);
    });

    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = await readJsonFile(file);
        if (Array.isArray(data)) {
          this.weaveState.importRecipes(data, WeaveRecipe);
          this.render();
        }
      } catch (err) {
        alert('Invalid weave file.');
        console.error(err);
      }
    });

    this.render();
  }

  #saveCurrent() {
    const name = this.el.nameInput.value.trim();
    if (!name) {
      alert('Please enter a name for the weave.');
      return;
    }
    const sides = sidesForGridLayout(this.#currentLayout);
    const recipe = new WeaveRecipe({
      id: generateId(),
      name,
      sides,
      n: this.weaveState.n,
      leap: this.weaveState.leap,
      colorCount: this.palette.size,
      colors: this.palette.getAll().map((s) => s.color),
    });
    this.weaveState.addRecipe(recipe);
    this.render();
    this.el.nameInput.value = '';
  }

  render() {
    const list = this.el.listEl;
    list.innerHTML = '';
    this.listItems.clear();

    for (const recipe of this.weaveState.recipes) {
      const li = document.createElement('li');
      const colorNote = recipe.colorCount ? `, ${recipe.colorCount} colors` : '';
      li.textContent = `${recipe.name} (${shapeNameForSides(recipe.sides)}, N=${recipe.n}, leap=${recipe.leap}${colorNote})`;
      li.style.cursor = 'pointer';
      li.style.marginBottom = '4px';
      li.addEventListener('click', () => this.#loadRecipe(recipe));
      this.listItems.set(recipe.id, li);
      list.appendChild(li);
    }
  }

  /**
   * Loads a saved/imported recipe: applies its N/leap and resizes/recolors
   * the palette to match its color count (see `#applyRecipeColors`).
   * Deliberately does *not* touch the current live selection - if you've
   * just ctrl+clicked a handful of cells (empty or already-woven), loading a
   * recipe here is exactly how you stamp it onto all of them at once, since
   * every live cell re-syncs to the new N/leap/colors on the very next
   * frame (see `App.js`'s draw loop / `ThreeApp.js#refreshLiveWeaveCurves`).
   * With nothing currently selected, this just becomes the setting the next
   * click (plain or ctrl) will place new cells with. `sides` is never used
   * to override the current grid (see `WeaveRecipe`'s own doc), only to warn
   * here if it doesn't match what the board actually provides - a
   * hexagon-tuned design stamped onto square cells is a valid (if
   * different-looking) thing to try, not an error, so this still applies
   * everything either way.
   * @param {import('../models/WeaveRecipe.js').WeaveRecipe} recipe
   */
  #loadRecipe(recipe) {
    const currentSides = sidesForGridLayout(this.#currentLayout);
    if (recipe.sides !== currentSides) {
      alert(
        `"${recipe.name}" was designed for a ${shapeNameForSides(recipe.sides)} (${recipe.sides} sides), ` +
          `but the current board is a ${shapeNameForGridLayout(this.#currentLayout)}. Loading it anyway.`
      );
    }
    this.weaveState.setN(recipe.n);
    this.weaveState.setLeap(recipe.leap);
    this.#applyRecipeColors(recipe);
  }

  /**
   * Resizes the palette to `recipe.colorCount` (default lead colors fill any
   * new slots - see `StrokePalette#resize`), then overwrites every slot with
   * `recipe.colors` when the recipe actually specifies them - exactly
   * `FavoritesUI#applyBundle`'s own resize-then-recolor sequence, just
   * sourced from a `WeaveRecipe` instead of a saved color bundle. A recipe
   * with no `colorCount` at all (a hand-edited or pre-color-tracking file)
   * leaves the palette untouched.
   * @param {import('../models/WeaveRecipe.js').WeaveRecipe} recipe
   */
  #applyRecipeColors(recipe) {
    const count = recipe.colorCount;
    if (!count || count < 1) return;

    if (count !== this.palette.size) {
      this.palette.resize(count);
      this.colorPickerUI.rebuild();
      this.onPaletteResize(count);
    }

    if (Array.isArray(recipe.colors) && recipe.colors.length === count) {
      recipe.colors.forEach((color, idx) => {
        this.palette.setColor(idx, color);
        this.colorPickerUI.syncPicker(idx);
      });
    }
  }

  /** Reflects the grid's current layout in the read-only shape label, and remembers it for the shape-mismatch check above - call whenever the grid's shape changes (e.g. the 3D page's "Grid Shape" control). */
  setGridLayout(layout) {
    this.#currentLayout = layout;
    this.el.shapeLabelEl.textContent = shapeNameForGridLayout(layout);
  }
}
