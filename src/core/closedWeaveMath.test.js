import { describe, it, expect } from 'vitest';
import { Point } from './Point.js';
import { closedWeaveSegmentsForCurve, closedWeaveInnerNailPositions } from './closedWeaveMath.js';

const triangle = [new Point(0, 0), new Point(10, 0), new Point(5, 10)];
const square = [new Point(0, 0), new Point(10, 0), new Point(10, 10), new Point(0, 10)];

describe('closedWeaveSegmentsForCurve', () => {
  it('returns no segments for fewer than 3 corners', () => {
    expect(closedWeaveSegmentsForCurve([triangle[0], triangle[1]], 4, 2, [{ color: '#fff', enabled: true }])).toEqual([]);
  });

  it('skips disabled color layers entirely', () => {
    const strokes = [
      { color: '#fff', enabled: true },
      { color: '#000', enabled: false },
    ];
    const segments = closedWeaveSegmentsForCurve(triangle, 8, 2, strokes);
    expect(segments.every((s) => s.color === '#fff')).toBe(true);
  });

  it('produces (n + 1) * sides segments per enabled color layer', () => {
    const strokes = [{ color: '#abc', enabled: true }];
    const n = 8;
    const segments = closedWeaveSegmentsForCurve(triangle, n, 3, strokes);
    expect(segments).toHaveLength((n + 1) * triangle.length);
  });

  it('matches the hand-derived triangle walkthrough (N=8, leap=2): point 0 of edge 1 connects to point 2 of edge 2', () => {
    // Verified in the leap-weave write-up: L1·0 -> L2·2, ..., L1·6 -> L3·0 (wraps onto a corner).
    const n = 8;
    const strokes = [{ color: '#abc', enabled: true }];
    const segments = closedWeaveSegmentsForCurve(triangle, n, 2, strokes);
    const perEdge = n + 1; // 9 points per edge: corner (0) + 8 inner nails

    // Edge 0 point 0 is the triangle's own first corner.
    const edge0Point0 = segments.find((s) => s.from === triangle[0]);
    expect(edge0Point0).toBeDefined();
    // step = perEdge + leap = 9 + 2 = 11, so edge0 point0 (global index 0)
    // connects to global index 11 -> edge index 1 (11 / 9 = 1), point index 2 (11 % 9).
    // Build edge 1's own point list the same way the module does, to assert
    // against its actual inner-nail position rather than a magic coordinate.
    const { innerPoints } = closedWeaveInnerNailPositions(triangle, n);
    // edge 1's inner nails are innerPoints[n..2n-1] (edge 0's fill innerPoints[0..n-1]).
    expect(edge0Point0.to).toEqual(innerPoints[n + 1]); // edge1's point index 2 = its 2nd inner nail (index 1 within edge1's inner nails)
  });

  it('a corner can be both an origin and a target (leap = per-edge count skips exactly one full edge)', () => {
    // Square, N=8: per-edge count is 9; leap=9 makes every point land on the
    // *same* local index one edge further around (Example C from the write-up).
    const n = 8;
    const strokes = [{ color: '#abc', enabled: true }];
    const segments = closedWeaveSegmentsForCurve(square, n, 9, strokes);
    const cornerToCorner = segments.find((s) => s.from === square[0]);
    expect(cornerToCorner).toBeDefined();
    expect(cornerToCorner.to).toEqual(square[2]); // opposite corner, same local index (0)
  });
});

describe('closedWeaveInnerNailPositions', () => {
  it('returns n inner points per edge, none equal to a corner', () => {
    const n = 5;
    const { controlPoints, innerPoints } = closedWeaveInnerNailPositions(triangle, n);
    expect(controlPoints).toEqual(triangle);
    expect(innerPoints).toHaveLength(n * triangle.length);
    for (const corner of triangle) {
      expect(innerPoints).not.toContainEqual(corner);
    }
  });

  it('returns no inner points when n is 0', () => {
    const { innerPoints } = closedWeaveInnerNailPositions(square, 0);
    expect(innerPoints).toEqual([]);
  });
});
