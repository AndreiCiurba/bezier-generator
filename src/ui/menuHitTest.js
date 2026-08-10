/**
 * True if the given screen point (in p5's mouseX/mouseY space) lands on a
 * menu, button, or input rather than the canvas - used to stop a click from
 * also registering as a canvas point placement.
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
