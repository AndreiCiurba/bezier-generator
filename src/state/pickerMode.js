/**
 * Which color picker opens when a palette swatch is clicked: the native
 * browser/OS picker ("default") or the categorized custom palette
 * ("custom") - see ColorPickerUI and CustomColorPopover.
 *
 * Persisted to localStorage so the choice survives a reload - the first use
 * of localStorage in this codebase (everything else here is in-memory-only
 * per session, restored only via manual JSON export/import). Kept as a
 * small pure-function module, same shape as colorCount.js. Reads/writes go
 * through `globalThis.localStorage` (rather than `window.localStorage`) so
 * a test can drop in a minimal in-memory fake without needing a DOM
 * environment (this project has no jsdom/happy-dom dependency).
 */

export const PICKER_MODES = ['default', 'custom'];
export const DEFAULT_PICKER_MODE = 'default';

const STORAGE_KEY = 'stringArt.colorPickerMode';

/** True for any string that's a recognized picker mode. */
export function isValidPickerMode(value) {
  return PICKER_MODES.includes(value);
}

/**
 * Reads the persisted picker mode. Falls back to DEFAULT_PICKER_MODE for a
 * missing/invalid stored value, or when localStorage itself is unavailable
 * (e.g. disabled/blocked) - never throws.
 * @returns {'default' | 'custom'}
 */
export function getPickerMode() {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    return isValidPickerMode(stored) ? stored : DEFAULT_PICKER_MODE;
  } catch {
    return DEFAULT_PICKER_MODE;
  }
}

/**
 * Persists a picker mode. Invalid values are ignored (no-op) rather than
 * throwing, so a caller can pass user/UI input straight through.
 * @param {string} mode
 */
export function setPickerMode(mode) {
  if (!isValidPickerMode(mode)) return;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, mode);
  } catch {
    // localStorage unavailable (disabled/blocked/quota) - mode just won't persist.
  }
}
