const DEFAULT_COLORS = [
  '#AEC8A4',
  '#8A784E',
  '#3B3B1A',
  '#33eaa2',
  '#11ff11',
  '#1111ff',
  '#ff1111',
  '#ffffff',
];

/**
 * The fixed set of stroke "slots" (one per color input in the UI). Each slot has
 * a color and an enabled flag (toggled via right-click - see ColorPickerUI) that
 * lets a color be temporarily excluded from rendering without losing its value.
 */
export class StrokePalette {
  #slots;

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
  }

  toggleEnabled(index) {
    this.#slots[index].enabled = !this.#slots[index].enabled;
    return this.#slots[index].enabled;
  }

  /** Deep-cloned snapshot, safe to store on a Curve without aliasing live slot objects. */
  snapshot() {
    return this.#slots.map((s) => ({ color: s.color, enabled: s.enabled }));
  }
}
