/**
 * Wires the 8 `<input type="color">` swatches to a StrokePalette: left-click
 * changes the color, right-click toggles that layer on/off.
 *
 * The original app split this in two: colors.js wired the color-change
 * listener, and src/listener/color.js separately queried the *same* pickers
 * to add both a right-click toggle listener AND a second, redundant
 * color-change listener that duplicated the one in colors.js. This merges
 * both concerns into a single pass over the pickers with one listener each.
 */
export class ColorPickerUI {
  /**
   * @param {HTMLElement} container element wrapping the color inputs
   * @param {import('../state/StrokePalette.js').StrokePalette} palette
   */
  constructor(container, palette) {
    this.pickers = [...container.querySelectorAll('input[type="color"]')];
    this.palette = palette;
  }

  init() {
    this.pickers.forEach((picker, index) => {
      picker.value = this.palette.getSlot(index).color;

      picker.addEventListener('input', () => {
        this.palette.setColor(index, picker.value);
      });

      picker.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const enabled = this.palette.toggleEnabled(index);
        this.#updateEnabledVisual(picker, enabled);
      });
    });
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
