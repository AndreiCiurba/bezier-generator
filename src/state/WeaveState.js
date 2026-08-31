const DEFAULT_N = 8;
const DEFAULT_LEAP = 3;

/**
 * The Weave feature's own settings: how many inner nails per edge (`n`),
 * the base `leap`, Manual/Auto placement mode (same shape as
 * `PatternStore#placementMode`), and which cells are currently "live" - kept
 * in a `Set` of *cell ids* (see `cellDetection.js#cellIdForCorners`), not
 * curve ids, so a cell can be selected before it has a curve at all.
 * Ctrl-click-toggled one at a time (see `WeaveUI`) - the caller (`App.js`/
 * `ThreeApp.js#handleWeaveClick`) creates a curve for a not-yet-placed cell
 * the moment it's ctrl-clicked, so every live cell id always has a real
 * curve to go with it by the time anything reads this set. A curve whose
 * cell id is in the live selection keeps regenerating from *this* store's
 * current `n`/`leap` (and the palette's current enabled colors) every frame
 * - including picking up a saved recipe applied while it's live (see
 * `WeaveUI#loadRecipe`, which deliberately does *not* reset this selection)
 * - everything else renders exactly as it was placed. `reset()` releases the
 * whole selection back to frozen without touching any curve's current
 * geometry/colors.
 */
export class WeaveState {
  #n;
  #leap;
  #placementMode = 'manual';
  #neighborRadius = 0;
  #liveSelection = new Set();
  #recipes = [];
  #listeners = new Set();

  constructor(n = DEFAULT_N, leap = DEFAULT_LEAP) {
    this.#n = n;
    this.#leap = leap;
  }

  get n() {
    return this.#n;
  }

  get leap() {
    return this.#leap;
  }

  get placementMode() {
    return this.#placementMode;
  }

  /**
   * Manual mode's placement "brush size": 0 places just the clicked cell
   * (the original behavior); 1 also places its nearest 8 neighbors (9
   * cells total); 2 its nearest 24 (25 total); generally `(2r+1)^2 - 1`
   * neighbors, the same Moore-neighborhood formula regardless of the grid's
   * actual shape - see `cellDetection.js#cellsWithinNeighborRadius`. Every
   * cell touched by one such click joins the live selection together (see
   * `selectOnlyMany`), so they can still be tuned as a group afterward.
   */
  get neighborRadius() {
    return this.#neighborRadius;
  }

  /** Live reference - read-only by convention, mutate only via `toggleLive`/`selectOnly`/`reset`. */
  get liveSelection() {
    return this.#liveSelection;
  }

  setN(n) {
    this.#n = n;
    this.#notify();
  }

  setLeap(leap) {
    this.#leap = leap;
    this.#notify();
  }

  togglePlacementMode() {
    this.#placementMode = this.#placementMode === 'manual' ? 'auto' : 'manual';
    this.#notify();
    return this.#placementMode;
  }

  setNeighborRadius(radius) {
    this.#neighborRadius = Math.max(0, radius);
    this.#notify();
  }

  isLive(cellId) {
    return this.#liveSelection.has(cellId);
  }

  /** Ctrl+click on a cell: add its cell id to the live selection if absent, drop it if already present - additive multi-select, doesn't touch any other id. Works the same whether or not that cell has a curve yet - see this class's own doc. */
  toggleLive(cellId) {
    if (this.#liveSelection.has(cellId)) this.#liveSelection.delete(cellId);
    else this.#liveSelection.add(cellId);
    this.#notify();
  }

  /** Plain click on a cell: the live selection becomes just this one cell id - standard select-replaces-selection convention. */
  selectOnly(cellId) {
    this.selectOnlyMany([cellId]);
  }

  /**
   * Same as `selectOnly`, for a whole group at once - a neighborhood-radius
   * click places/touches several cells together, and all of them should
   * become live as one group (see `neighborRadius`'s own doc), not just the
   * one directly under the cursor.
   * @param {string[]} cellIds
   */
  selectOnlyMany(cellIds) {
    this.#liveSelection.clear();
    for (const id of cellIds) this.#liveSelection.add(id);
    this.#notify();
  }

  /** Releases every currently-live cell back to frozen, without altering any curve's current geometry/colors. */
  reset() {
    this.#liveSelection.clear();
    this.#notify();
  }

  /** Every saved `WeaveRecipe`, in save order - the Weave menu's "Saved Weaves" list. */
  get recipes() {
    return this.#recipes;
  }

  addRecipe(recipe) {
    this.#recipes.push(recipe);
    this.#notify();
  }

  findRecipeById(id) {
    return this.#recipes.find((r) => r.id === id) ?? null;
  }

  /**
   * Replaces the whole saved-recipes list, e.g. after importing a JSON file
   * exported from the standalone playground - same shape/convention as
   * `PatternStore#importPatterns`.
   * @param {unknown[]} rawRecipes
   * @param {typeof import('../models/WeaveRecipe.js').WeaveRecipe} RecipeClass
   */
  importRecipes(rawRecipes, RecipeClass) {
    for (const raw of rawRecipes) {
      if (raw.name && raw.id && typeof raw.sides === 'number' && typeof raw.n === 'number' && typeof raw.leap === 'number') {
        this.#recipes.push(new RecipeClass(raw));
      }
    }
    this.#notify();
  }

  /**
   * Subscribes to any setN/setLeap/togglePlacementMode/toggleLive/
   * selectOnly/reset change. Returns an unsubscribe function - same shape
   * as `StrokePalette#onChange`/`CurveStore#onChange`.
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
