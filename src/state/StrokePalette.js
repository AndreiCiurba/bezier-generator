import { leadColorForIndex } from '../data/categoryLeadColors.js';

const DEFAULT_SLOT_COUNT = 8;
// Each default slot gets that category's lead color (see categoryLeadColors.js) -
// real, curated colors from the custom palette instead of an arbitrary hardcoded
// list, so Default-mode swatches start out already matching a Custom-mode category.
const DEFAULT_COLORS = Array.from({ length: DEFAULT_SLOT_COUNT }, (_, i) => leadColorForIndex(i));

/**
 * The fixed set of stroke "slots" (one per color input in the UI). Each slot has
 * a color and an enabled flag (toggled via right-click - see ColorPickerUI) that
 * lets a color be temporarily excluded from rendering without losing its value.
 */
export class StrokePalette {
  #slots;
  #listeners = new Set();

  constructor(initialColors = DEFAULT_COLORS) {
    this.#slots = initialColors.map((color) => ({ color, enabled: true }));
  }

  get size() {
    return this.#slots.length;
  }

  getSlot(index) {
    return this.#slots[index];
  }

  /** Live reference to all slots - used by rendering, which reads `.color`/`.enabled` per frame. */
  getAll() {
    return this.#slots;
  }

  getEnabledColors() {
    return this.#slots.filter((s) => s.enabled).map((s) => s.color);
  }

  setColor(index, hex) {
    this.#slots[index].color = hex;
    this.#notify();
  }

  toggleEnabled(index) {
    this.#slots[index].enabled = !this.#slots[index].enabled;
    this.#notify();
    return this.#slots[index].enabled;
  }

  /**
   * Grows or shrinks the slot count. Shrinking truncates from the end;
   * growing appends new enabled slots, each colored by calling
   * `fillColorFn(index)` once per new slot - `index` is that slot's
   * absolute position in the palette, so growth after growth keeps
   * advancing through the same sequence rather than restarting it.
   * Defaults to `leadColorForIndex`, cycling through each category's lead
   * color (see categoryLeadColors.js) rather than a random one - more
   * useful than several identical or arbitrary new swatches. Existing
   * slots that remain in range keep their color/enabled state untouched.
   */
  resize(newSize, fillColorFn = leadColorForIndex) {
    if (newSize === this.#slots.length) return;
    if (newSize < this.#slots.length) {
      this.#slots.length = newSize;
    } else {
      for (let i = this.#slots.length; i < newSize; i++) {
        this.#slots.push({ color: fillColorFn(i), enabled: true });
      }
    }
    this.#notify();
  }

  /** Deep-cloned snapshot, safe to store on a Curve without aliasing live slot objects. */
  snapshot() {
    return this.#slots.map((s) => ({ color: s.color, enabled: s.enabled }));
  }

  /**
   * Subscribes to any setColor/toggleEnabled/resize change. Returns an
   * unsubscribe function - same shape as `CurveStore#onChange`. Needed by
   * renderers with no continuous per-frame redraw of their own (the 3D page)
   * to know when to re-sync anything reading live palette state, e.g. the
   * Auto-mode "keep already-stamped pattern curves live" feature (see
   * `models/Curve.js#isLiveAutoPatternCurve`).
   * @param {() => void} listener
   * @returns {() => void}
   */
  onChange(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #notify() {
    for (const listener of this.#listeners) listener();
  }
}
