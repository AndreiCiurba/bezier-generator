/**
 * Saved 8-color palette "bundles" the user can re-apply later.
 * Each bundle is a plain array of hex strings (only the enabled colors, in order -
 * matches StrokePalette#getEnabledColors, which is what gets saved).
 */
export class FavoritesStore {
  #bundles = [];

  get bundles() {
    return this.#bundles;
  }

  has(bundle) {
    return this.#bundles.some((b) => JSON.stringify(b) === JSON.stringify(bundle));
  }

  add(bundle) {
    if (this.has(bundle)) return false;
    this.#bundles.push(bundle);
    return true;
  }

  replaceAll(bundles) {
    this.#bundles = bundles;
  }
}
