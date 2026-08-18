const STORAGE_KEY = 'bezier3d-theme';

/**
 * Light/dark toggle for this page only - doesn't touch any app/design
 * state, just flips `data-theme` on `<html>`. Every color on this page
 * already comes from a token that keys off that attribute (see
 * three-page.css's theming blocks), including the toggle button's own
 * sun/moon icon swap, so there's nothing else to sync here.
 *
 * With no explicit choice ever saved, the page already follows the OS/
 * browser's `prefers-color-scheme` via a plain CSS media query - this class
 * only needs to (a) restore a previously *saved* override on load, and
 * (b) flip + persist it on click.
 */
export class ThemeToggle {
  /** @param {HTMLElement} buttonEl */
  constructor(buttonEl) {
    this.button = buttonEl;
  }

  init() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      document.documentElement.setAttribute('data-theme', stored);
    }
    this.button.addEventListener('click', () => this.#toggle());
  }

  #toggle() {
    const next = this.#effectiveTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  #effectiveTheme() {
    const explicit = document.documentElement.getAttribute('data-theme');
    if (explicit === 'light' || explicit === 'dark') return explicit;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
