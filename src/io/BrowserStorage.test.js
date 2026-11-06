import { describe, it, expect, afterEach, vi } from 'vitest';
import { saveToStorage, loadFromStorage, clearFromStorage } from './BrowserStorage.js';

function createFakeLocalStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  };
}

describe('BrowserStorage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('round-trips a JSON-serializable value through save/load', () => {
    vi.stubGlobal('localStorage', createFakeLocalStorage());
    saveToStorage('test-key', { a: 1, b: [1, 2, 3] });
    expect(loadFromStorage('test-key')).toEqual({ a: 1, b: [1, 2, 3] });
  });

  it('returns null for a key that was never saved', () => {
    vi.stubGlobal('localStorage', createFakeLocalStorage());
    expect(loadFromStorage('missing-key')).toBeNull();
  });

  it('clearFromStorage removes a previously saved value', () => {
    vi.stubGlobal('localStorage', createFakeLocalStorage());
    saveToStorage('test-key', 'value');

    clearFromStorage('test-key');

    expect(loadFromStorage('test-key')).toBeNull();
  });

  it('namespaces keys so callers never collide with an unrelated raw key of the same name', () => {
    const fake = createFakeLocalStorage();
    vi.stubGlobal('localStorage', fake);

    saveToStorage('shapeLibrary', ['shape']);

    expect(fake.getItem('shapeLibrary')).toBeNull();
    expect(fake.getItem('bezier:shapeLibrary')).not.toBeNull();
  });

  it('does not throw, and treats storage as empty, when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);

    expect(() => saveToStorage('k', 1)).not.toThrow();
    expect(loadFromStorage('k')).toBeNull();
    expect(() => clearFromStorage('k')).not.toThrow();
  });
});
