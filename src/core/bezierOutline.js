/**
 * Pure geometry for the Shape Designer's hand-drawn closed bezier outlines -
 * no p5/DOM dependency, so it's unit-testable like `weaveMath.js`/
 * `closedWeaveMath.js`.
 *
 * An anchor is `{x, y, handleIn, handleOut}` - `handleIn`/`handleOut` are
 * absolute points (not deltas from the anchor), so dragging a handle in the
 * editor is just "set it to the current mouse position". Either handle may
 * be `null`, meaning "not explicitly set" - `autoHandles` fills those in with
 * a smooth Catmull-Rom-style tangent so a freshly placed ring of anchors (a
 * preset, or anchors clicked one at a time) already looks smooth with no
 * manual handle dragging. A handle explicitly set to its own anchor's
 * position (zero-length) degenerates that side of the curve to a straight
 * line - `shapePresets.js`'s straight-edged presets (triangle, rect) rely on
 * exactly this.
 *
 * The closed outline itself is a loop of cubic bezier segments, one per
 * anchor: anchor[i] -> anchor[i].handleOut -> anchor[i+1].handleIn ->
 * anchor[i+1], wrapping anchor[n] back to anchor[0]. `resampleClosedOutline`
 * is the one function the rest of the app actually needs: it turns that
 * smooth loop into exactly `nailCount` evenly arc-length-spaced points, which
 * feed directly into the *existing* `closedWeaveMath.js#closedWeaveSegmentsForCurve`
 * as `cellCorners` (with `n = 0`, since each resampled point already is a
 * nail - no further per-edge subdivision needed).
 *
 * @typedef {{x: number, y: number}} Vec2
 * @typedef {{x: number, y: number, handleIn: Vec2|null, handleOut: Vec2|null}} Anchor
 */

// How many points are missing before the Catmull-Rom estimate degenerates -
// below this a "closed loop" isn't really one, so callers should treat it as
// an empty/degenerate shape (mirrors closedWeaveMath.js's own `sides < 3`
// guard for the same reason: no real closed polygon exists below a triangle).
// Exported so `ShapeEditorState` can gate "is this shape closeable yet?"
// against the exact same threshold instead of a second hardcoded `3`.
export const MIN_CLOSED_ANCHORS = 3;

/**
 * The standard "kappa" constant for approximating a quarter circle with one
 * cubic bezier segment - the closest a 4-anchor cubic bezier loop can get to
 * a true circle. Exported for `shapePresets.js`'s circle/oval generators.
 */
export const CIRCLE_KAPPA = 0.5522847498307936;

/**
 * A Catmull-Rom-style tangent at `curr`, estimated from its closed-loop
 * neighbors `prev`/`next` - proportional to the chord `next - prev`, scaled
 * down so the resulting handle sits a reasonable fraction of the way to each
 * neighbor rather than overshooting.
 * @param {Vec2} prev @param {Vec2} curr @param {Vec2} next
 * @returns {Vec2}
 */
function catmullRomTangent(prev, next) {
  return { x: (next.x - prev.x) / 6, y: (next.y - prev.y) / 6 };
}

/**
 * Resolves every anchor's *effective* handles: an explicit `handleIn`/
 * `handleOut` is kept as-is, a missing one is computed from
 * `catmullRomTangent` through that anchor's closed-loop neighbors.
 * @param {Anchor[]} anchors
 * @returns {{point: Vec2, handleIn: Vec2, handleOut: Vec2}[]}
 */
export function autoHandles(anchors) {
  const n = anchors.length;
  if (n === 0) return [];

  return anchors.map((anchor, i) => {
    const point = { x: anchor.x, y: anchor.y };
    if (anchor.handleIn && anchor.handleOut) {
      return { point, handleIn: anchor.handleIn, handleOut: anchor.handleOut };
    }

    const prev = anchors[(i - 1 + n) % n];
    const next = anchors[(i + 1) % n];
    const tangent = catmullRomTangent(prev, next);
    const handleOut = anchor.handleOut ?? { x: point.x + tangent.x, y: point.y + tangent.y };
    const handleIn = anchor.handleIn ?? { x: point.x - tangent.x, y: point.y - tangent.y };
    return { point, handleIn, handleOut };
  });
}

/** One point on a cubic bezier `p0 -> p1 -> p2 -> p3` at parameter `t` (0..1). */
function cubicBezierPoint(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

/**
 * A dense polyline approximation of the closed bezier loop, plus the length
 * of each segment between consecutive polyline points (wrapping the last
 * back to the first) - the shared groundwork both `sampleClosedOutline` (just
 * wants the points, for a live preview guide line) and
 * `resampleClosedOutline` (walks the lengths to resample by arc length) need.
 * @param {Anchor[]} anchors
 * @param {number} samplesPerSegment
 * @returns {{points: Vec2[], segmentLengths: number[], total: number}}
 */
function densePolylineWithLengths(anchors, samplesPerSegment) {
  const resolved = autoHandles(anchors);
  const n = resolved.length;
  const points = [];
  for (let i = 0; i < n; i++) {
    const curr = resolved[i];
    const next = resolved[(i + 1) % n];
    for (let s = 0; s < samplesPerSegment; s++) {
      points.push(cubicBezierPoint(curr.point, curr.handleOut, next.handleIn, next.point, s / samplesPerSegment));
    }
  }

  const segmentLengths = points.map((p, i) => {
    const q = points[(i + 1) % points.length];
    return Math.hypot(q.x - p.x, q.y - p.y);
  });
  const total = segmentLengths.reduce((sum, l) => sum + l, 0);
  return { points, segmentLengths, total };
}

/**
 * A dense `{x,y}[]` polyline approximation of the closed bezier loop - for
 * drawing a smooth live preview guide line while editing. `[]` below
 * `MIN_CLOSED_ANCHORS` anchors (no real closed shape yet).
 * @param {Anchor[]} anchors
 * @param {number} samplesPerSegment sub-divisions per anchor-to-anchor segment; higher = smoother
 * @returns {Vec2[]}
 */
export function sampleClosedOutline(anchors, samplesPerSegment = 24) {
  if (anchors.length < MIN_CLOSED_ANCHORS) return [];
  return densePolylineWithLengths(anchors, samplesPerSegment).points;
}

/**
 * Exactly `nailCount` points, evenly spaced by arc length around the closed
 * bezier loop - the actual nail positions a shape's weave connects. `[]`
 * below `MIN_CLOSED_ANCHORS` anchors or a non-positive `nailCount`.
 * @param {Anchor[]} anchors
 * @param {number} nailCount
 * @param {number} samplesPerSegment density of the dense polyline this resamples from; higher = more accurate at large `nailCount`
 * @returns {Vec2[]}
 */
export function resampleClosedOutline(anchors, nailCount, samplesPerSegment = 24) {
  if (anchors.length < MIN_CLOSED_ANCHORS || nailCount < 1) return [];

  const { points, segmentLengths, total } = densePolylineWithLengths(anchors, samplesPerSegment);
  if (total === 0) return Array.from({ length: nailCount }, () => ({ x: anchors[0].x, y: anchors[0].y }));

  const step = total / nailCount;
  const result = [];
  let i = 0;
  let segStart = 0; // cumulative arc length at points[i]
  for (let k = 0; k < nailCount; k++) {
    const target = k * step;
    while (i < points.length - 1 && segStart + segmentLengths[i] < target) {
      segStart += segmentLengths[i];
      i++;
    }
    const localLength = segmentLengths[i] || 1e-9;
    const t = Math.min(1, Math.max(0, (target - segStart) / localLength));
    const a = points[i];
    const b = points[(i + 1) % points.length];
    result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return result;
}
