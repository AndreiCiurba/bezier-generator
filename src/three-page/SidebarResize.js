const STORAGE_KEY = 'bezier3d-sidebar-width';
const MIN_WIDTH = 220; // px - stays usable (labels/inputs still fit) below the old 280px floor
const MAX_WIDTH_FRACTION = 0.7; // vs. window.innerWidth - leaves the 3D view usable at any width
const MOBILE_BREAKPOINT = 720; // px - matches three-page.css's own `@media (max-width: 720px)`

/**
 * Drag-to-resize the toolbar via the handle strip on its right edge (see
 * `.sidebar-resize-handle` in three-page.css). Pure pointer-events math -
 * doesn't touch anything else on the page, just writes `#ui`'s inline
 * `width`, which overrides the CSS `width: clamp(...)` default (15vw by
 * default) once the user has dragged at least once. Persists like
 * `ThemeToggle`'s theme choice does, so a resize survives reload.
 */
export class SidebarResize {
  #panel;
  #handle;
  #startX = 0;
  #startWidth = 0;
  // The user's last explicitly-chosen width (px), independent of viewport
  // size - null until a drag or a restored localStorage value sets it.
  #lastWidth = null;

  /** @param {HTMLElement} panelEl the `#ui` sidebar itself @param {HTMLElement} handleEl the drag strip on its edge */
  constructor(panelEl, handleEl) {
    this.#panel = panelEl;
    this.#handle = handleEl;
  }

  init() {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    if (stored > 0) {
      this.#lastWidth = stored;
      this.#applyLastWidth();
    }
    this.#handle.addEventListener('pointerdown', this.#handlePointerDown);
    // Below the mobile breakpoint #ui always goes full-width (see
    // three-page.css's responsive block) - an inline px width from a
    // desktop-size drag would otherwise sit in front of that rule and
    // never let it take over.
    window.addEventListener('resize', this.#handleWindowResize);
  }

  #handlePointerDown = (event) => {
    event.preventDefault();
    this.#startX = event.clientX;
    this.#startWidth = this.#panel.getBoundingClientRect().width;
    this.#handle.classList.add('resizing');
    this.#handle.setPointerCapture(event.pointerId);
    window.addEventListener('pointermove', this.#handlePointerMove);
    window.addEventListener('pointerup', this.#handlePointerUp);
  };

  #handlePointerMove = (event) => {
    this.#lastWidth = this.#clamp(this.#startWidth + (event.clientX - this.#startX));
    this.#panel.style.width = `${this.#lastWidth}px`;
  };

  #handlePointerUp = () => {
    this.#handle.classList.remove('resizing');
    window.removeEventListener('pointermove', this.#handlePointerMove);
    window.removeEventListener('pointerup', this.#handlePointerUp);
    if (this.#lastWidth !== null) localStorage.setItem(STORAGE_KEY, String(this.#lastWidth));
  };

  #handleWindowResize = () => {
    if (this.#lastWidth === null) return; // never dragged/restored - CSS default stays fully in control
    if (window.innerWidth <= MOBILE_BREAKPOINT) {
      this.#panel.style.width = ''; // hand control back to the mobile full-width CSS rule
    } else {
      this.#applyLastWidth();
    }
  };

  #applyLastWidth() {
    this.#panel.style.width = `${this.#clamp(this.#lastWidth)}px`;
  }

  #clamp(width) {
    return Math.min(Math.max(width, MIN_WIDTH), window.innerWidth * MAX_WIDTH_FRACTION);
  }
}
