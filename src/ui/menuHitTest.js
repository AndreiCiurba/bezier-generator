/**
 * True if the given point lands on a menu, button, or input rather than the
 * canvas - used to stop a click from also registering as a canvas point
 * placement.
 *
 * Takes viewport-relative coordinates (p5's `winMouseX`/`winMouseY`, NOT
 * `mouseX`/`mouseY`) - `elementFromPoint` needs a position relative to the
 * page, but `mouseX`/`mouseY` are relative to the canvas element itself.
 * Those two only coincide when the canvas sits at the page origin (true
 * enough for the grid tool's window-filling canvas); freestyle's canvas is
 * centered and can sit hundreds of pixels away from (0, 0), so passing
 * `mouseX`/`mouseY` here would check the wrong point on the page entirely -
 * e.g. a click on the burger icon could silently miss every menu element
 * and fall through as a canvas point placement.
 *
 * Relies on every menu/submenu sharing the `.panel` class (see
 * css/styles.css), so it covers any current or future submenu without
 * hardcoding IDs.
 */
export function touchesMenus(x, y) {
  const el = document.elementFromPoint(x, y);
  return Boolean(
    el && (el.closest('button') || el.closest('input') || el.closest('.panel') || el.closest('#burger'))
  );
}
