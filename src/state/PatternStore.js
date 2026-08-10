/**
 * Saved patterns, plus which one (if any) is currently selected for stamping.
 *
 * "Placement mode" replaces the old `usePatternManually` boolean: `'manual'`
 * stamps one copy per click, `'auto'` stamps a copy at every grid point at once.
 */
export class PatternStore {
  #patterns = [];
  #selectedPatternId = null;
  #inUse = false;
  #placementMode = 'manual';
  #preview = null; // { pattern, mousePosition } while hovering a saved-pattern list entry

  get patterns() {
    return this.#patterns;
  }

  get selectedPatternId() {
    return this.#selectedPatternId;
  }

  get isInUse() {
    return this.#inUse;
  }

  get placementMode() {
    return this.#placementMode;
  }

  get preview() {
    return this.#preview;
  }

  add(pattern) {
    this.#patterns.push(pattern);
  }

  findById(id) {
    return this.#patterns.find((p) => p.id === id) ?? null;
  }

  get selectedPattern() {
    return this.findById(this.#selectedPatternId);
  }

  select(id, inUse = true) {
    this.#selectedPatternId = id;
    this.#inUse = inUse;
  }

  /** Clears the active pattern selection (e.g. Reset, Clear All, Escape). */
  clearSelection() {
    this.#selectedPatternId = null;
    this.#inUse = false;
  }

  togglePlacementMode() {
    this.#placementMode = this.#placementMode === 'manual' ? 'auto' : 'manual';
    return this.#placementMode;
  }

  setPreview(pattern, mousePosition) {
    this.#preview = { pattern, mousePosition };
  }

  clearPreview() {
    this.#preview = null;
  }

  /** Replaces the whole saved-patterns list, e.g. after importing a JSON file. */
  importPatterns(rawPatterns, PatternClass) {
    for (const raw of rawPatterns) {
      if (raw.name && raw.points && raw.id) {
        this.#patterns.push(
          new PatternClass({ id: raw.id, name: raw.name, points: raw.points, colors: raw.colors })
        );
      }
    }
  }
}
