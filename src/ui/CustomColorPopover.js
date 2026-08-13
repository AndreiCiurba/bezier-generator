import { loadCustomPalette, groupByCategory } from '../state/customPaletteData.js';

/**
 * The "Custom" picker: a single popover, shared by every swatch on the
 * page, that shows the categorized palette (one row per category, square
 * swatches, hex on hover only - see docs/color_picker_v2_epic.md) and reports
 * the chosen hex back to whoever opened it. It never touches StrokePalette
 * or any other app state itself - `openFor` takes an `onSelect(hex)`
 * callback, so ColorPickerUI stays the only thing that actually writes
 * color state. That keeps this a drop-in replacement for the moment the
 * native `<input type="color">` would have fired its own change event,
 * with no second/parallel representation of "the selected color".
 *
 * Outside-click/Escape-to-close is a new interaction pattern for this app -
 * every other panel here (Panel/PanelGroup) only closes via an explicit X
 * button or another panel in the same group opening. There's no existing
 * precedent to reuse, so it's implemented directly here.
 */
export class CustomColorPopover {
  #el = null;
  #onSelect = null;
  #onOutsideClick = (event) => {
    if (this.#el && !this.#el.contains(event.target) && event.target !== this.#currentAnchor) {
      this.close();
    }
  };
  #onKeydown = (event) => {
    if (event.key === 'Escape') this.close();
  };
  #currentAnchor = null;

  get isOpen() {
    return this.#el !== null;
  }

  /**
   * Opens (or repositions, if already open for a different swatch) the
   * popover anchored below `anchorEl`. Never changes any color itself -
   * `onSelect(hex)` fires only once the user explicitly clicks a swatch.
   * @param {HTMLElement} anchorEl the swatch that triggered this open
   * @param {(hex: string) => void} onSelect
   */
  async openFor(anchorEl, onSelect) {
    this.#currentAnchor = anchorEl;
    this.#onSelect = onSelect;

    let records;
    try {
      records = await loadCustomPalette();
    } catch (err) {
      console.error('Custom color palette failed to load:', err);
      return;
    }
    // The anchor may have been clicked again, or the popover closed, while
    // the fetch was in flight - bail rather than opening stale/unwanted UI.
    if (this.#currentAnchor !== anchorEl) return;

    this.#render(groupByCategory(records));
    this.#position(anchorEl);
    document.addEventListener('mousedown', this.#onOutsideClick, true);
    document.addEventListener('keydown', this.#onKeydown, true);
  }

  close() {
    if (!this.#el) return;
    this.#el.remove();
    this.#el = null;
    this.#currentAnchor = null;
    this.#onSelect = null;
    document.removeEventListener('mousedown', this.#onOutsideClick, true);
    document.removeEventListener('keydown', this.#onKeydown, true);
  }

  #render(groupedCategories) {
    this.#el?.remove();

    const popover = document.createElement('div');
    popover.className = 'custom-palette-popover';

    for (const { category, colors } of groupedCategories) {
      const row = document.createElement('div');
      row.className = 'custom-palette-row';
      // Category/subcategory are intentionally not rendered as text labels
      // here - see the epic's "no color names or subcategory names in the
      // palette" requirement. `category` still ends up in the DOM as a
      // non-visual `title`-free data attribute, useful for debugging only.
      row.dataset.category = category;

      for (const { hex } of colors) {
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'color-btn';
        swatch.style.backgroundColor = hex;
        swatch.title = hex; // hover tooltip - the only place the hex value is exposed
        swatch.addEventListener('click', () => {
          const onSelect = this.#onSelect;
          this.close();
          onSelect?.(hex);
        });
        row.appendChild(swatch);
      }

      popover.appendChild(row);
    }

    document.body.appendChild(popover);
    this.#el = popover;
  }

  #position(anchorEl) {
    const rect = anchorEl.getBoundingClientRect();
    const popover = this.#el;
    // Provisional placement below-left of the anchor, then clamped to stay
    // on-screen - the palette can be several rows tall (up to 17 colors in
    // the widest category) so it easily overflows near a viewport edge.
    popover.style.position = 'fixed';
    popover.style.left = `${rect.left}px`;
    popover.style.top = `${rect.bottom + 6}px`;

    const bounds = popover.getBoundingClientRect();
    const overflowRight = bounds.right - window.innerWidth;
    if (overflowRight > 0) {
      popover.style.left = `${Math.max(4, rect.left - overflowRight)}px`;
    }
    const overflowBottom = bounds.bottom - window.innerHeight;
    if (overflowBottom > 0) {
      // Flip above the anchor instead when there's no room below.
      popover.style.top = `${Math.max(4, rect.top - bounds.height - 6)}px`;
    }
  }
}
