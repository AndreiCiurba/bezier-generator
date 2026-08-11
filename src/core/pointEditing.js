/**
 * Pure geometry for the freestyle "ctrl-drag a control point" editor (backlog
 * item 8) - hit-testing which point a click landed on, and propagating a drag
 * across a pattern's other stamped copies when Shift is held. No p5/DOM
 * dependency, so directly unit-testable.
 */

/**
 * Finds the point (across every curve) closest to `position`, within
 * `maxDistance`. Used for control-point hit testing on ctrl-click - the
 * caller is expected to pass `maxDistance` already converted into whatever
 * coordinate space `position` and the curves' points are in (e.g. a screen-px
 * pick radius divided by the current zoom, for a world-space search).
 * @param {import('../models/Curve.js').Curve[]} curves
 * @param {{x:number,y:number}} position
 * @param {number} maxDistance
 * @returns {{curve: import('../models/Curve.js').Curve, pointIndex: number, distance: number}|null}
 */
export function findNearestCurvePoint(curves, position, maxDistance) {
  let best = null;
  let bestDistance = maxDistance;

  for (const curve of curves) {
    for (let i = 0; i < curve.points.length; i++) {
      const distance = curve.points[i].distanceTo(position);
      if (distance <= bestDistance) {
        bestDistance = distance;
        best = { curve, pointIndex: i, distance };
      }
    }
  }

  return best;
}

/**
 * Moves point `pointIndex` on every *other* curve stamped from the same
 * pattern as `sourceCurve` by the given delta - the "move all copies
 * together" half of the drag (Shift held). No-op for manually-drawn curves
 * (`patternId === null`), since there's nothing else to keep in sync.
 * Mutates the sibling curves' points in place.
 * @param {import('../models/Curve.js').Curve[]} curves
 * @param {import('../models/Curve.js').Curve} sourceCurve the curve already being dragged directly
 * @param {number} pointIndex
 * @param {number} dx
 * @param {number} dy
 */
export function shiftSiblingPoints(curves, sourceCurve, pointIndex, dx, dy) {
  if (sourceCurve.patternId === null) return;

  for (const curve of curves) {
    if (curve === sourceCurve) continue;
    if (!curve.belongsToPattern(sourceCurve.patternId)) continue;

    const point = curve.points[pointIndex];
    if (!point) continue;
    point.set(point.x + dx, point.y + dy);
  }
}
