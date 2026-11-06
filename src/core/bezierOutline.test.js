import { describe, it, expect } from 'vitest';
import { autoHandles, sampleClosedOutline, resampleClosedOutline } from './bezierOutline.js';
import { triangleAnchors, circleAnchors } from './shapePresets.js';

// A square ring with every handle left `null`, for exercising autoHandles'
// own Catmull-Rom estimate rather than a preset's pre-filled handles.
const nullHandleSquare = [
  { x: 0, y: 0, handleIn: null, handleOut: null },
  { x: 10, y: 0, handleIn: null, handleOut: null },
  { x: 10, y: 10, handleIn: null, handleOut: null },
  { x: 0, y: 10, handleIn: null, handleOut: null },
];

describe('autoHandles', () => {
  it('returns an empty array for an empty anchor list', () => {
    expect(autoHandles([])).toEqual([]);
  });

  it('keeps an anchor with both handles already explicit untouched', () => {
    const anchor = { x: 5, y: 5, handleIn: { x: 1, y: 1 }, handleOut: { x: 9, y: 9 } };
    const [resolved] = autoHandles([anchor, ...nullHandleSquare.slice(0, 2)]);
    expect(resolved).toEqual({ point: { x: 5, y: 5 }, handleIn: { x: 1, y: 1 }, handleOut: { x: 9, y: 9 } });
  });

  it('fills a missing handle pair with a Catmull-Rom tangent through its closed-loop neighbors', () => {
    const resolved = autoHandles(nullHandleSquare);
    // Anchor 0 = (0,0); its neighbors wrap to anchor 3 = (0,10) and anchor 1 = (10,0).
    const tangent = { x: (10 - 0) / 6, y: (0 - 10) / 6 };
    expect(resolved[0]).toEqual({
      point: { x: 0, y: 0 },
      handleOut: { x: 0 + tangent.x, y: 0 + tangent.y },
      handleIn: { x: 0 - tangent.x, y: 0 - tangent.y },
    });
  });
});

describe('sampleClosedOutline', () => {
  it('returns no points below 3 anchors - no real closed shape exists yet', () => {
    expect(sampleClosedOutline([{ x: 0, y: 0, handleIn: null, handleOut: null }])).toEqual([]);
  });

  it('returns samplesPerSegment points per anchor', () => {
    const triangle = triangleAnchors({ x: 0, y: 0 }, 10);
    expect(sampleClosedOutline(triangle, 12)).toHaveLength(12 * 3);
  });

  it('samples lie exactly on the straight chord between anchors when every handle is zero-length', () => {
    // triangleAnchors sets every handle to its own anchor's position, which
    // degenerates each edge to a straight line (see bezierOutline.js's own
    // doc) - the midpoint sample of the first edge should be the exact
    // geometric midpoint between anchor 0 and anchor 1.
    const triangle = triangleAnchors({ x: 0, y: 0 }, 10);
    const samplesPerSegment = 10;
    const points = sampleClosedOutline(triangle, samplesPerSegment);
    const midOfFirstEdge = points[samplesPerSegment / 2];
    const expectedMid = { x: (triangle[0].x + triangle[1].x) / 2, y: (triangle[0].y + triangle[1].y) / 2 };
    expect(midOfFirstEdge.x).toBeCloseTo(expectedMid.x, 9);
    expect(midOfFirstEdge.y).toBeCloseTo(expectedMid.y, 9);
  });
});

describe('resampleClosedOutline', () => {
  it('returns no points below 3 anchors or a non-positive nail count', () => {
    const triangle = triangleAnchors({ x: 0, y: 0 }, 10);
    expect(resampleClosedOutline([triangle[0], triangle[1]], 20)).toEqual([]);
    expect(resampleClosedOutline(triangle, 0)).toEqual([]);
  });

  it('returns exactly nailCount points', () => {
    const triangle = triangleAnchors({ x: 0, y: 0 }, 10);
    expect(resampleClosedOutline(triangle, 37)).toHaveLength(37);
  });

  it('spaces nails evenly by arc length around a straight-edged shape', () => {
    const triangle = triangleAnchors({ x: 0, y: 0 }, 10);
    const nails = resampleClosedOutline(triangle, 30);
    const distances = nails.map((p, i) => {
      const next = nails[(i + 1) % nails.length];
      return Math.hypot(next.x - p.x, next.y - p.y);
    });
    const first = distances[0];
    for (const d of distances) expect(d).toBeCloseTo(first, 6);
  });

  it('keeps every resampled nail close to the true circle radius for a circle preset', () => {
    const radius = 10;
    const circle = circleAnchors({ x: 0, y: 0 }, radius);
    const nails = resampleClosedOutline(circle, 24);
    for (const nail of nails) {
      const distanceFromCenter = Math.hypot(nail.x, nail.y);
      expect(Math.abs(distanceFromCenter - radius)).toBeLessThan(radius * 0.01);
    }
  });
});
