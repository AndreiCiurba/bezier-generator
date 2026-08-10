/**
 * True if the segment from `from` to `to` is, within `tolerance`, perfectly
 * horizontal or perfectly vertical - "straight" the same way the
 * graph-paper backdrop's own lines run (they're just horizontal/vertical
 * lines across the canvas). Coordinate-space-agnostic: pass screen-space
 * points for a zoom-independent tolerance, or world-space for one that
 * scales with zoom.
 * @param {{x:number,y:number}} from
 * @param {{x:number,y:number}} to
 * @param {number} tolerance
 */
export function isAxisAligned(from, to, tolerance) {
  return Math.abs(from.x - to.x) <= tolerance || Math.abs(from.y - to.y) <= tolerance;
}
