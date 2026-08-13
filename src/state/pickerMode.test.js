import { describe, it, expect, beforeEach } from 'vitest';
import { getPickerMode, setPickerMode, isValidPickerMode, DEFAULT_PICKER_MODE } from './pickerMode.js';

/**
 * pickerMode.js reads/writes `globalThis.localStorage` rather than
 * `window.localStorage` specifically so it can be tested with this minimal
 * in-memory fake - this project runs Vitest in the default 'node'
 * environment (no jsdom/happy-dom dependency), so there's no real
 * localStorage available otherwise.
 */
function installFakeLocalStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

describe('isValidPickerMode', () => {
  it('accepts "default" and "custom"', () => {
    expect(isValidPickerMode('default')).toBe(true);
    expect(isValidPickerMode('custom')).toBe(true);
  });

  it('rejects anything else, including null/undefined', () => {
    expect(isValidPickerMode('bogus')).toBe(false);
    expect(isValidPickerMode(null)).toBe(false);
    expect(isValidPickerMode(undefined)).toBe(false);
    expect(isValidPickerMode('')).toBe(false);
  });
});

describe('getPickerMode / setPickerMode', () => {
  beforeEach(() => {
    installFakeLocalStorage();
  });

  it('defaults to "default" when nothing is stored', () => {
    expect(getPickerMode()).toBe(DEFAULT_PICKER_MODE);
  });

  it('round-trips a valid mode through localStorage', () => {
    setPickerMode('custom');
    expect(getPickerMode()).toBe('custom');
  });

  it('falls back to default when the stored value is invalid (e.g. corrupted/old)', () => {
    globalThis.localStorage.setItem('stringArt.colorPickerMode', 'not-a-real-mode');
    expect(getPickerMode()).toBe(DEFAULT_PICKER_MODE);
  });

  it('ignores an attempt to persist an invalid mode', () => {
    setPickerMode('custom');
    setPickerMode('bogus');
    expect(getPickerMode()).toBe('custom');
  });

  it('does not throw when localStorage is entirely unavailable', () => {
    delete globalThis.localStorage;
    expect(() => setPickerMode('custom')).not.toThrow();
    expect(getPickerMode()).toBe(DEFAULT_PICKER_MODE);
  });
});
