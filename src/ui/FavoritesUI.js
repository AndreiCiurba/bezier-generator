import { Panel } from './Panel.js';
import { downloadJson, readJsonFile } from '../io/JsonFile.js';

/**
 * Wires the "Colors" submenu: saving/exporting/importing favorite color
 * bundles, and applying a bundle back onto the palette when clicked.
 * Applying a bundle whose size differs from the current palette resizes the
 * palette to match first (e.g. a bundle saved/exported with 11 colors,
 * later imported and applied against the 8-color default, brings the
 * palette to 11) - so every color in the bundle actually lands somewhere.
 *
 * Fixes one dead-on-arrival bit of the original: `closeColorSubmenuBtn` had
 * *two* click listeners bound to it (colors.js used the same element ID for
 * both an assumed "open" trigger and the real close button), which raced and
 * left the X button effectively doing nothing. There's only one close button
 * in the markup, so there's only one listener now, and it actually closes
 * the panel.
 */
export class FavoritesUI {
  /**
   * @param {{
   *   panelEl: HTMLElement, openBtn: HTMLElement, closeBtn: HTMLElement,
   *   saveBtn: HTMLElement, exportBtn: HTMLElement, importBtn: HTMLElement,
   *   importInput: HTMLInputElement, bundlesContainer: HTMLElement,
   * }} elements
   * @param {import('../state/FavoritesStore.js').FavoritesStore} favorites
   * @param {import('../state/StrokePalette.js').StrokePalette} palette
   * @param {import('./ColorPickerUI.js').ColorPickerUI} colorPickerUI
   * @param {import('./PanelGroup.js').PanelGroup} submenuGroup keeps this and the Patterns submenu mutually exclusive
   * @param {(newSize: number) => void} [onPaletteResize] called after a bundle apply resizes the palette, so e.g. a color-count field can reflect the new size
   */
  constructor(elements, favorites, palette, colorPickerUI, submenuGroup, onPaletteResize = () => {}) {
    this.el = elements;
    this.panel = submenuGroup.register(new Panel(elements.panelEl));
    this.favorites = favorites;
    this.palette = palette;
    this.colorPickerUI = colorPickerUI;
    this.submenuGroup = submenuGroup;
    this.onPaletteResize = onPaletteResize;
  }

  init() {
    const { openBtn, closeBtn, saveBtn, exportBtn, importBtn, importInput } = this.el;

    openBtn.addEventListener('click', () => {
      if (this.panel.isOpen) {
        this.panel.close();
      } else {
        this.submenuGroup.openOnly(this.panel);
      }
    });
    closeBtn.addEventListener('click', () => this.panel.close());

    saveBtn.addEventListener('click', () => {
      this.favorites.add(this.palette.getEnabledColors());
      this.render();
    });

    exportBtn.addEventListener('click', () => {
      downloadJson(this.favorites.bundles, 'color-lists.json');
    });

    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const imported = await readJsonFile(file);
        const isValid =
          Array.isArray(imported) &&
          imported.every((bundle) => Array.isArray(bundle) && bundle.every((c) => typeof c === 'string'));
        if (!isValid) throw new Error('Invalid file format');
        this.favorites.replaceAll(imported);
        this.render();
      } catch {
        alert('Invalid file format. Please import an array of color triplets.');
      }
    });

    this.render();
  }

  render() {
    const container = this.el.bundlesContainer;
    container.innerHTML = '';

    for (const bundle of this.favorites.bundles) {
      const bundleDiv = document.createElement('div');
      bundleDiv.classList.add('bundle');

      bundle.forEach((color) => {
        const colorBtn = document.createElement('button');
        colorBtn.classList.add('color-btn');
        colorBtn.style.backgroundColor = color;
        colorBtn.title = color;
        bundleDiv.appendChild(colorBtn);
      });

      bundleDiv.addEventListener('click', () => this.#applyBundle(bundleDiv, bundle));
      container.appendChild(bundleDiv);
    }
  }

  #applyBundle(bundleDiv, bundle) {
    if (bundle.length === 0) return;

    document.querySelectorAll('.bundle').forEach((b) => b.classList.remove('selected'));
    bundleDiv.classList.add('selected');

    if (bundle.length !== this.palette.size) {
      this.palette.resize(bundle.length);
      this.colorPickerUI.rebuild();
      this.onPaletteResize(bundle.length);
    }

    bundle.forEach((color, idx) => {
      this.palette.setColor(idx, color);
      this.colorPickerUI.syncPicker(idx);
    });
  }
}
