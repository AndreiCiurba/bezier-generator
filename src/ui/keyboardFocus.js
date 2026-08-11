/**
 * True if `target` is a form field that should receive normal typing - used
 * to stop single-letter keyboard shortcuts (like the pattern flip hotkeys)
 * from firing while the user is typing into e.g. the pattern name field.
 */
export function isTypingTarget(target) {
  return Boolean(target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}
