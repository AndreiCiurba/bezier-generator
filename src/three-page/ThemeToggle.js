const STORAGE_KEY = 'bezier-theme';
const LEGACY_STORAGE_KEY = 'bezier3d-theme'; // the 3D page's old key - still honored

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
    const stored = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
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
    return 'dark'; // dark is the default when nothing was chosen
  }
}

/** Adds the sun/moon toggle button to a page's `.page-nav` (pages other than 3D, which has its own in the sidebar). */
export function initThemeToggle() {
  const nav = document.querySelector('.page-nav');
  if (!nav) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'page-nav-link theme-toggle-btn';
  button.setAttribute('aria-label', 'Toggle light/dark theme');
  button.innerHTML =
    '<svg class="icon icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/>' +
    '<line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.6" y1="4.6" x2="6.7" y2="6.7"/>' +
    '<line x1="17.3" y1="17.3" x2="19.4" y2="19.4"/><line x1="4.6" y1="19.4" x2="6.7" y2="17.3"/><line x1="17.3" y1="6.7" x2="19.4" y2="4.6"/></svg>' +
    '<svg class="icon icon-moon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/></svg>';
  nav.appendChild(button);
  new ThemeToggle(button).init();
}
