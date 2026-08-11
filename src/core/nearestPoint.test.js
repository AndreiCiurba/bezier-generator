import { describe, it, expect } from 'vitest';
import { findNearestPoint } from './nearestPoint.js';
import { Point } from './Point.js';

describe('findNearestPoint', () => {
  it('returns the truly nearest point, not just the first match within range', () => {
    // The first point in the array is farther than the second - the classic
    // bug this replaced ("first match within range, then break") got this wrong.
    const points = [new Point(0, 8), new Point(0, 2)];
    expect(findNearestPoint(points, new Point(0, 0), 10)).toBe(points[1]);
  });

  it('returns null when nothing is within range, instead of throwing', () => {
    const points = [new Point(1000, 1000)];
    expect(findNearestPoint(points, new Point(0, 0), 10)).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(findNearestPoint([], new Point(0, 0), 10)).toBeNull();
  });

  it('is inclusive at exactly maxDistance', () => {
    const points = [new Point(10, 0)];
    expect(findNearestPoint(points, new Point(0, 0), 10)).toBe(points[0]);
    expect(findNearestPoint(points, new Point(0, 0), 9.99)).toBeNull();
  });

  it('defaults maxDistance to 10', () => {
    const points = [new Point(9, 0)];
    expect(findNearestPoint(points, new Point(0, 0))).toBe(points[0]);
  });
});
