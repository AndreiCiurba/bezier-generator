import { describe, it, expect } from 'vitest';
import { Point } from './Point.js';
import { subdivide, computeWeaveSegments, weaveSegmentsForCurve } from './weaveMath.js';

describe('subdivide', () => {
  it('returns segments+1 points including both endpoints', () => {
    const a = new Point(0, 0);
    const b = new Point(10, 0);
    const points = subdivide(a, b, 4);
    expect(points).toHaveLength(5);
    expect(points[0]).toEqual(a);
    expect(points[4]).toEqual(b);
    expect(points[2].x).toBe(5);
  });
});

describe('computeWeaveSegments', () => {
  const p1 = new Point(0, 0);
  const p2 = new Point(10, 0);
  const p3 = new Point(10, 10);

  it('layer 0 connects each point on side 1 to the next point on side 2', () => {
    const pairs = computeWeaveSegments(p1, p2, p3, 0, 2);
    // k=0 -> toIndex=1 (valid), k=1 -> toIndex=2 (valid): both segments draw.
    expect(pairs).toHaveLength(2);
    expect(pairs[0].from).toEqual(subdivideAt(p1, p2, 2, 0));
    expect(pairs[0].to).toEqual(subdivideAt(p2, p3, 2, 1));
  });

  it('higher layers shift the fan and can drop segments whose target index falls out of range', () => {
    // k=0 -> toIndex=0 (invalid, must be >0): dropped. k=1 -> toIndex=1 (valid): kept.
    const pairs = computeWeaveSegments(p1, p2, p3, 1, 2);
    expect(pairs).toHaveLength(1);
  });

  it('a layer index beyond the segment count yields no pairs rather than out-of-range indices', () => {
    const pairs = computeWeaveSegments(p1, p2, p3, 10, 3);
    expect(pairs).toHaveLength(0);
  });
});

function subdivideAt(a, b, segments, index) {
  return subdivide(a, b, segments)[index];
}

describe('weaveSegmentsForCurve', () => {
  const points = [new Point(0, 0), new Point(10, 0), new Point(10, 10), new Point(0, 10)];

  it('skips disabled layers entirely', () => {
    const strokes = [
      { color: '#fff', enabled: true },
      { color: '#000', enabled: false },
    ];
    const segments = weaveSegmentsForCurve(points, strokes, 2);
    expect(segments.every((s) => s.color === '#fff')).toBe(true);
  });

  it('matches computeWeaveSegments summed across every triplet and layer', () => {
    const strokes = [{ color: '#abc', enabled: true }];
    const segments = weaveSegmentsForCurve(points, strokes, 3);

    let expectedCount = 0;
    for (let i = 0; i < points.length - 2; i++) {
      expectedCount += computeWeaveSegments(points[i], points[i + 1], points[i + 2], 0, 3).length;
    }
    expect(segments).toHaveLength(expectedCount);
  });

  it('returns no segments for fewer than 3 points', () => {
    expect(weaveSegmentsForCurve([points[0], points[1]], [{ color: '#fff', enabled: true }], 4)).toEqual([]);
  });
});
