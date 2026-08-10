/**
 * Wires the palette's color swatches to a StrokePalette: left-click changes
 * the color, right-click toggles that layer on/off. Owns creating the
 * `<input type="color">` elements itself (rather than assuming the markup
 * already has them) so the count can change - see `rebuild()`, used by
 * freestyle's color-count picker. The grid tool never resizes its palette,
 * so for it this just creates the same 8 inputs it always rendered.
 *
 * The original app split this in two: colors.js wired the color-change
 * listener, and src/listener/color.js separately queried the *same* pickers
 * to add both a right-click toggle listener AND a second, redundant
 * color-change listener that duplicated the one in colors.js. This merges
 * both concerns into a single pass, one listener each.
 */
export class ColorPickerUI {
  /**
   * @param {HTMLElement} container element to hold the color inputs (its
   *   existing children, if any, are discarded and rebuilt from the palette)
   * @param {import('../state/StrokePalette.js').StrokePalette} palette
   */
  constructor(container, palette) {
    this.container = container;
    this.palette = palette;
    this.pickers = [];
  }

  init() {
    this.rebuild();
  }

  /** Recreates the picker elements to match the palette's current size. Call after resizing the palette. */
  rebuild() {
    this.container.innerHTML = '';
    this.pickers = [];

    for (let index = 0; index < this.palette.size; index++) {
      const picker = document.createElement('input');
      picker.type = 'color';
      picker.value = this.palette.getSlot(index).color;

      picker.addEventListener('input', () => {
        this.palette.setColor(index, picker.value);
      });

      picker.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const enabled = this.palette.toggleEnabled(index);
        this.#updateEnabledVisual(picker, enabled);
      });

      this.#updateEnabledVisual(picker, this.palette.getSlot(index).enabled);
      this.pickers.push(picker);
      this.container.appendChild(picker);
    }
  }

  /** Reflects a slot's color/enabled state back into its picker, e.g. after applying a favorite bundle. */
  syncPicker(index) {
    const slot = this.palette.getSlot(index);
    this.pickers[index].value = slot.color;
    this.#updateEnabledVisual(this.pickers[index], slot.enabled);
  }

  #updateEnabledVisual(picker, enabled) {
    picker.style.opacity = enabled ? '1' : '0.1';
    picker.style.border = enabled ? '2px solid transparent' : '2px solid white';
  }
}
