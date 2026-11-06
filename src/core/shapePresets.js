import { CIRCLE_KAPPA } from './bezierOutline.js';

/**
 * Pure generator functions for the Shape Designer's preset buttons - each
 * returns a ready-to-reshape anchor ring (see `bezierOutline.js`'s own doc
 * for the anchor shape) dropped at `center`, rather than a fixed, un-editable
 * curve. Dragging any anchor/handle afterward is how a circle preset becomes
 * an oval, a blob, etc. - these just supply a reasonable starting point.
 */

/**
 * A 4-anchor cubic-bezier ellipse - the standard "kappa" construction, the
 * closest a 4-anchor cubic bezier loop gets to a true ellipse. Both handles
 * are explicit (never `null`), so `autoHandles` never overrides them with its
 * own Catmull-Rom estimate.
 * @param {{x:number,y:number}} center
 * @param {number} radiusX
 * @param {number} radiusY
 * @returns {import('./bezierOutline.js').Anchor[]}
 */
export function ovalAnchors(center, radiusX, radiusY) {
  const kx = radiusX * CIRCLE_KAPPA;
  const ky = radiusY * CIRCLE_KAPPA;
  const { x: cx, y: cy } = center;
  return [
    { x: cx + radiusX, y: cy, handleIn: { x: cx + radiusX, y: cy - ky }, handleOut: { x: cx + radiusX, y: cy + ky } },
    { x: cx, y: cy + radiusY, handleIn: { x: cx + kx, y: cy + radiusY }, handleOut: { x: cx - kx, y: cy + radiusY } },
    { x: cx - radiusX, y: cy, handleIn: { x: cx - radiusX, y: cy + ky }, handleOut: { x: cx - radiusX, y: cy - ky } },
    { x: cx, y: cy - radiusY, handleIn: { x: cx - kx, y: cy - radiusY }, handleOut: { x: cx + kx, y: cy - radiusY } },
  ];
}

/** A circle preset - `ovalAnchors` with equal radii. */
export function circleAnchors(center, radius) {
  return ovalAnchors(center, radius, radius);
}

/**
 * A straight-edged regular polygon preset (triangle for `sides = 3`, used
 * directly by `rectAnchors` for `sides = 4`) - every handle is explicitly set
 * to its own anchor's position (zero-length), which degenerates every edge
 * of the loop to a straight line (see `bezierOutline.js`'s own doc on why a
 * zero-length handle does that) rather than `autoHandles`' smooth rounding.
 * @param {{x:number,y:number}} center
 * @param {number} radius
 * @param {number} sides
 * @param {number} [startAngle] radians; defaults to pointing straight up
 * @returns {import('./bezierOutline.js').Anchor[]}
 */
function straightPolygonAnchors(center, radius, sides, startAngle = -Math.PI / 2) {
  const anchors = [];
  for (let i = 0; i < sides; i++) {
    const angle = startAngle + (i * 2 * Math.PI) / sides;
    const x = center.x + radius * Math.cos(angle);
    const y = center.y + radius * Math.sin(angle);
    anchors.push({ x, y, handleIn: { x, y }, handleOut: { x, y } });
  }
  return anchors;
}

/** A straight-edged triangle preset, point-up. */
export function triangleAnchors(center, radius) {
  return straightPolygonAnchors(center, radius, 3);
}

/** A straight-edged square/rect preset (a circumscribing-radius square, corner-up). */
export function rectAnchors(center, radius) {
  return straightPolygonAnchors(center, radius, 4, -Math.PI / 4);
}
