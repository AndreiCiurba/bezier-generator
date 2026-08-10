/**
 * How far `to` is from being perfectly aligned with `from` along at least
 * one axis - the smaller of the x-difference and y-difference. 0 means
 * perfectly horizontal or perfectly vertical; larger values mean further
 * from either. Coordinate-space-agnostic: pass screen-space points for a
 * zoom-independent result, or world-space for one that scales with zoom.
 * @param {{x:number,y:number}} from
 * @param {{x:number,y:number}} to
 */
export function axisMisalignment(from, to) {
  return Math.min(Math.abs(from.x - to.x), Math.abs(from.y - to.y));
}

/**
 * Maps a misalignment distance to a 0..1 "closeness" value: 1 at offset 0
 * (perfectly aligned), fading linearly down to 0 at/beyond `maxDistance`.
 * Used to drive a continuous color gradient instead of a hard on/off snap.
 * @param {number} offset @param {number} maxDistance
 */
export function alignmentCloseness(offset, maxDistance) {
  if (maxDistance <= 0) return offset <= 0 ? 1 : 0;
  return Math.max(0, Math.min(1, 1 - offset / maxDistance));
}
