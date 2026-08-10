/**
 * A random opaque hex color, e.g. "#a3f09c". Used to fill newly-added
 * palette slots (see StrokePalette#resize) so a grown palette doesn't just
 * pad itself with plain white.
 */
export function randomHexColor() {
  const value = Math.floor(Math.random() * 0x1000000);
  return `#${value.toString(16).padStart(6, '0')}`;
}
