/**
 * Pure 2D rigid-ish transform (translate + rotate + uniform scale) for one
 * `FreeformShape`'s anchors - what the Arrange board applies to a shape's own
 * stored outline to get one placed instance's actual on-board geometry,
 * before resampling it into nails (see `bezierOutline.js#resampleClosedOutline`).
 *
 * The pivot is the shape's own anchor centroid, not its first anchor or the
 * world origin - rotating/scaling "in place" around the shape's own middle
 * is what a user dragging a rotate/scale handle on a placed instance expects,
 * and it's also exactly what makes `position` mean "where the shape's own
 * center ends up," independent of wherever its anchors happened to be drawn
 * on the Shape Designer's canvas.
 */

/** The average of every anchor's own `{x,y}` - the transform's pivot. @param {{x:number,y:number}[]} anchors @returns {{x:number,y:number}} */
export function anchorsCentroid(anchors) {
  const n = anchors.length;
  const sum = anchors.reduce((acc, a) => ({ x: acc.x + a.x, y: acc.y + a.y }), { x: 0, y: 0 });
  return { x: sum.x / n, y: sum.y / n };
}

/** Rotates+scales `point` around `centroid`, without the final translate - a shared step for an anchor and its handles, which all move together. */
function rotateScaleAroundCentroid(point, centroid, cos, sin, scale) {
  const dx = (point.x - centroid.x) * scale;
  const dy = (point.y - centroid.y) * scale;
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}

/**
 * Rigidly transforms every anchor (and its handles, if any) around the
 * shape's own centroid, then translates the whole result so that centroid
 * lands exactly on `position`.
 * @param {import('./bezierOutline.js').Anchor[]} anchors
 * @param {{position: {x:number,y:number}, rotationRadians?: number, scale?: number}} transform
 * @returns {import('./bezierOutline.js').Anchor[]}
 */
export function transformAnchors(anchors, { position, rotationRadians = 0, scale = 1 }) {
  const centroid = anchorsCentroid(anchors);
  const cos = Math.cos(rotationRadians);
  const sin = Math.sin(rotationRadians);

  const place = (point) => {
    const local = rotateScaleAroundCentroid(point, centroid, cos, sin, scale);
    return { x: position.x + local.x, y: position.y + local.y };
  };

  return anchors.map((anchor) => ({
    ...place(anchor),
    handleIn: anchor.handleIn ? place(anchor.handleIn) : null,
    handleOut: anchor.handleOut ? place(anchor.handleOut) : null,
  }));
}
