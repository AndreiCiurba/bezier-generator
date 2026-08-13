import { getPickerMode } from '../state/pickerMode.js';
import { CustomColorPopover } from './CustomColorPopover.js';

/**
 * Wires the palette's color swatches to a StrokePalette: left-click changes
 * the color, right-click toggles that layer on/off. Owns creating the
 * swatch elements itself (rather than assuming the markup already has them)
 * so the count can change - see `rebuild()`, used by freestyle's
 * color-count picker. The grid tool never resizes its palette, so for it
 * this just creates the same 8 swatches it always rendered.
 *
 * The original app split this in two: colors.js wired the color-change
 * listener, and src/listener/color.js separately queried the *same* pickers
 * to add both a right-click toggle listener AND a second, redundant
 * color-change listener that duplicated the one in colors.js. This merges
 * both concerns into a single pass, one listener each.
 *
 * Color Picker V2: which element `rebuild()` creates per slot depends on the
 * current picker mode (see pickerMode.js) - a native `<input type="color">`
 * for "default" (unchanged from before), or a plain `<button>` swatch for
 * "custom" that opens a shared `CustomColorPopover` instead of the OS
 * picker. Either way, a pick always ends at the exact same
 * `this.palette.setColor(index, hex)` call - there's no second
 * representation of "the selected color" for custom mode to maintain.
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
    this.popover = new CustomColorPopover();
  }

  init() {
    this.rebuild();
  }

  /** Recreates the picker elements to match the palette's current size and current picker mode. Call after resizing the palette or toggling the mode. */
  rebuild() {
    this.container.innerHTML = '';
    this.pickers = [];
    const mode = getPickerMode();

    for (let index = 0; index < this.palette.size; index++) {
      const picker = mode === 'custom' ? this.#createCustomSwatch(index) : this.#createNativePicker(index);
      this.pickers.push(picker);
      this.container.appendChild(picker);
    }
  }

  /** Reflects a slot's color/enabled state back into its picker, e.g. after applying a favorite bundle. */
  syncPicker(index) {
    const slot = this.palette.getSlot(index);
    const picker = this.pickers[index];
    if (picker.tagName === 'INPUT') {
      picker.value = slot.color;
    } else {
      picker.style.backgroundColor = slot.color;
      picker.title = slot.color;
    }
    this.#updateEnabledVisual(picker, slot.enabled);
  }

  #createNativePicker(index) {
    const picker = document.createElement('input');
    picker.type = 'color';
    picker.value = this.palette.getSlot(index).color;

    picker.addEventListener('input', () => {
      this.palette.setColor(index, picker.value);
    });

    this.#wireEnabledToggle(picker, index);
    this.#updateEnabledVisual(picker, this.palette.getSlot(index).enabled);
    return picker;
  }

  #createCustomSwatch(index) {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'color-btn';
    const color = this.palette.getSlot(index).color;
    swatch.style.backgroundColor = color;
    swatch.title = color; // hover tooltip, same as the epic requires inside the popover itself

    swatch.addEventListener('click', () => {
      this.popover.openFor(swatch, (hex) => {
        this.palette.setColor(index, hex);
        this.syncPicker(index);
      });
    });

    this.#wireEnabledToggle(swatch, index);
    this.#updateEnabledVisual(swatch, this.palette.getSlot(index).enabled);
    return swatch;
  }

  #wireEnabledToggle(picker, index) {
    picker.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const enabled = this.palette.toggleEnabled(index);
      this.#updateEnabledVisual(picker, enabled);
    });
  }

  #updateEnabledVisual(picker, enabled) {
    picker.style.opacity = enabled ? '1' : '0.1';
    picker.style.border = enabled ? '2px solid transparent' : '2px solid white';
  }
}
