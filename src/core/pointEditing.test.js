import { describe, it, expect } from 'vitest';
import { findNearestCurvePoint, shiftSiblingPoints } from './pointEditing.js';
import { Curve } from '../models/Curve.js';
import { Point } from './Point.js';

function curveOf(...coords) {
  return new Curve(coords.map(([x, y]) => new Point(x, y)), []);
}

describe('findNearestCurvePoint', () => {
  it('returns null when nothing is within range', () => {
    const curves = [curveOf([0, 0], [100, 100])];
    expect(findNearestCurvePoint(curves, { x: 50, y: 50 }, 10)).toBeNull();
  });

  it('returns null for an empty curve list', () => {
    expect(findNearestCurvePoint([], { x: 0, y: 0 }, 100)).toBeNull();
  });

  it('finds the single closest point across multiple curves', () => {
    const a = curveOf([0, 0], [50, 50]);
    const b = curveOf([100, 100], [8, 1]);
    const hit = findNearestCurvePoint([a, b], { x: 9, y: 0 }, 20);

    expect(hit.curve).toBe(b);
    expect(hit.pointIndex).toBe(1);
    expect(hit.distance).toBeCloseTo(Math.hypot(1, 1), 5);
  });

  it('is inclusive at exactly maxDistance', () => {
    const a = curveOf([0, 0]);
    expect(findNearestCurvePoint([a], { x: 10, y: 0 }, 10)).not.toBeNull();
    expect(findNearestCurvePoint([a], { x: 10.01, y: 0 }, 10)).toBeNull();
  });
});

describe('shiftSiblingPoints', () => {
  it('does nothing for a manually-drawn curve (patternId null)', () => {
    const source = curveOf([0, 0], [10, 10]);
    const other = curveOf([0, 0], [10, 10]); // patternId null too - unrelated
    shiftSiblingPoints([source, other], source, 0, 5, 5);
    expect(other.points[0]).toEqual({ x: 0, y: 0 });
  });

  it('moves the same point index on every other curve sharing the pattern id', () => {
    const a = new Curve([new Point(0, 0), new Point(10, 0)], [], 'p1');
    const b = new Curve([new Point(50, 50), new Point(60, 50)], [], 'p1');
    const unrelated = new Curve([new Point(1, 1), new Point(2, 1)], [], 'p2');

    shiftSiblingPoints([a, b, unrelated], a, 1, 3, -4);

    expect(b.points[1]).toEqual({ x: 63, y: 46 });
    expect(unrelated.points[1]).toEqual({ x: 2, y: 1 }); // different pattern, untouched
  });

  it('does not touch the source curve itself', () => {
    const a = new Curve([new Point(0, 0)], [], 'p1');
    const b = new Curve([new Point(9, 9)], [], 'p1');
    shiftSiblingPoints([a, b], a, 0, 100, 100);
    expect(a.points[0]).toEqual({ x: 0, y: 0 });
  });

  it('skips a sibling that has no point at that index', () => {
    const a = new Curve([new Point(0, 0), new Point(1, 1)], [], 'p1');
    const short = new Curve([new Point(5, 5)], [], 'p1');
    expect(() => shiftSiblingPoints([a, short], a, 1, 1, 1)).not.toThrow();
    expect(short.points).toHaveLength(1);
  });
});
