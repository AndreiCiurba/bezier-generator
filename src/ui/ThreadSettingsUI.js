import { saveToStorage, loadFromStorage } from '../io/BrowserStorage.js';
import { THREAD_STORAGE_KEY } from '../io/storageKeys.js';
import {
  normalizeThreadSettings, MIN_THREAD_WIDTH_MM, MAX_THREAD_WIDTH_MM, MIN_NAIL_DIAMETER_MM, MAX_NAIL_DIAMETER_MM,
} from '../core/threadWrap.js';

/** The saved real thread setup (shared by Arrange and Cardioid), or the defaults. */
export function loadThreadSettings() {
  return normalizeThreadSettings(loadFromStorage(THREAD_STORAGE_KEY));
}

/**
 * Binds the "Thread & Nails" fields (thread width mm, nail width mm, 8/O wrap)
 * to a page's thread settings. Every change is saved under the one key both
 * pages read, and a change made in another tab is picked up live.
 */
export class ThreadSettingsUI {
  /**
   * @param {{threadInput: HTMLInputElement, nailInput: HTMLInputElement, wrapSelect: HTMLSelectElement}} elements
   * @param {() => {threadWidthMm:number, nailDiameterMm:number, technique:string}} getSettings
   * @param {(settings: {threadWidthMm:number, nailDiameterMm:number, technique:string}) => void} onChange
   */
  constructor({ threadInput, nailInput, wrapSelect }, getSettings, onChange) {
    this.threadInput = threadInput;
    this.nailInput = nailInput;
    this.wrapSelect = wrapSelect;
    this.getSettings = getSettings;
    this.onChange = onChange;
  }

  init() {
    this.#showCurrent();
    const readMm = (input, min, max, label) => {
      const value = Number(input.value);
      if (input.value.trim() === '' || !Number.isFinite(value) || value < min || value > max) {
        alert(`${label} must be between ${min} and ${max} mm.`);
        this.#showCurrent();
        return null;
      }
      return value;
    };
    this.threadInput.addEventListener('change', () => {
      const value = readMm(this.threadInput, MIN_THREAD_WIDTH_MM, MAX_THREAD_WIDTH_MM, 'Thread width');
      if (value !== null) this.#apply({ threadWidthMm: value });
    });
    this.nailInput.addEventListener('change', () => {
      const value = readMm(this.nailInput, MIN_NAIL_DIAMETER_MM, MAX_NAIL_DIAMETER_MM, 'Nail width');
      if (value !== null) this.#apply({ nailDiameterMm: value });
    });
    this.wrapSelect.addEventListener('change', () => this.#apply({ technique: this.wrapSelect.value }));

    window.addEventListener('storage', (event) => {
      if (event.key !== null && !event.key.endsWith(THREAD_STORAGE_KEY)) return;
      this.onChange(loadThreadSettings());
      this.#showCurrent();
    });
  }

  #apply(changes) {
    const settings = normalizeThreadSettings({ ...this.getSettings(), ...changes });
    saveToStorage(THREAD_STORAGE_KEY, settings);
    this.onChange(settings);
  }

  #showCurrent() {
    const settings = this.getSettings();
    this.threadInput.value = String(settings.threadWidthMm);
    this.nailInput.value = String(settings.nailDiameterMm);
    this.wrapSelect.value = settings.technique;
  }
}
