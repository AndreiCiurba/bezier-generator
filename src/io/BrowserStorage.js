/**
 * Thin `localStorage` wrapper - Phase 1 of `docs/persistence-plan.md`'s
 * "stop re-exporting/re-importing a JSON file every time you switch between
 * `/shapes/` and `/arrange/`" fix. Same-origin pages already share
 * `localStorage` automatically, so writing a shape library here on one page
 * and reading it back on another needs no server, no accounts, nothing
 * beyond what every page already has.
 *
 * Every call is wrapped in try/catch - `localStorage` can throw (private-
 * browsing mode in some browsers, a quota exceeded, or simply not existing
 * in a non-browser environment) and none of that should ever be fatal to
 * the app; falling back to "nothing was saved/loaded" is always safe here,
 * since every caller already has a sensible empty-state default.
 *
 * Callers namespace their own keys (see `io/storageKeys.js`) - this module
 * doesn't know or care what's being stored, only how to get a JSON-
 * serializable value in and out of `localStorage` safely.
 */

const NAMESPACE = 'bezier';

function namespacedKey(key) {
  return `${NAMESPACE}:${key}`;
}

/**
 * Serializes `value` to JSON and writes it under `key`. Silently no-ops
 * (after a console warning) if `localStorage` is unavailable or throws.
 * @param {string} key
 * @param {unknown} value
 */
export function saveToStorage(key, value) {
  try {
    localStorage.setItem(namespacedKey(key), JSON.stringify(value));
  } catch (err) {
    console.warn(`BrowserStorage: could not save "${key}"`, err);
  }
}

/**
 * Reads and JSON-parses whatever was last saved under `key`. Returns `null`
 * if nothing's been saved yet, or if reading/parsing fails for any reason
 * (unavailable storage, corrupted value, ...) - callers should treat `null`
 * exactly like "nothing saved," never as an error to surface.
 * @param {string} key
 * @returns {unknown|null}
 */
export function loadFromStorage(key) {
  try {
    const raw = localStorage.getItem(namespacedKey(key));
    return raw === null ? null : JSON.parse(raw);
  } catch (err) {
    console.warn(`BrowserStorage: could not load "${key}"`, err);
    return null;
  }
}

/**
 * Removes whatever was saved under `key`, if anything - e.g. a "Clear Saved
 * Library" button wiping this browser's persisted copy.
 * @param {string} key
 */
export function clearFromStorage(key) {
  try {
    localStorage.removeItem(namespacedKey(key));
  } catch (err) {
    console.warn(`BrowserStorage: could not clear "${key}"`, err);
  }
}
