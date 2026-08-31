import { describe, it, expect } from 'vitest';
import { nailPositionsForCurve } from './nailPositions.js';
import { Curve } from '../models/Curve.js';
import { Point } from './Point.js';

function colorsOfLength(n) {
  return Array.from({ length: n }, () => ({ color: '#fff', enabled: true }));
}

describe('nailPositionsForCurve', () => {
  it('returns curve.points as the control points, unchanged', () => {
    const points = [new Point(0, 0), new Point(10, 0), new Point(10, 10)];
    const curve = new Curve(points, colorsOfLength(4));
    expect(nailPositionsForCurve(curve).controlPoints).toBe(points);
  });

  it('has no inner points when segments is 1 (one color)', () => {
    const points = [new Point(0, 0), new Point(10, 0)];
    const curve = new Curve(points, colorsOfLength(1));
    expect(nailPositionsForCurve(curve).innerPoints).toEqual([]);
  });

  it('produces segments-1 inner points per edge, excluding both endpoints', () => {
    const points = [new Point(0, 0), new Point(8, 0)];
    const curve = new Curve(points, colorsOfLength(4));
    const { innerPoints } = nailPositionsForCurve(curve);

    expect(innerPoints).toHaveLength(3);
    expect(innerPoints.map((p) => p.x)).toEqual([2, 4, 6]);
    expect(innerPoints).not.toContainEqual({ x: 0, y: 0 });
    expect(innerPoints).not.toContainEqual({ x: 8, y: 0 });
  });

  it('covers every edge of a multi-point curve without duplicating shared endpoints', () => {
    const points = [new Point(0, 0), new Point(10, 0), new Point(10, 10)];
    const curve = new Curve(points, colorsOfLength(2));
    const { innerPoints } = nailPositionsForCurve(curve);

    // 2 edges * (segments-1 = 1) inner point each.
    expect(innerPoints).toHaveLength(2);
    expect(innerPoints[0]).toEqual({ x: 5, y: 0 });
    expect(innerPoints[1]).toEqual({ x: 10, y: 5 });
  });

  it('falls back to segments=1 (no inner points) for an empty colors array, rather than dividing by zero', () => {
    const points = [new Point(0, 0), new Point(10, 0)];
    const curve = new Curve(points, []);
    expect(() => nailPositionsForCurve(curve)).not.toThrow();
    expect(nailPositionsForCurve(curve).innerPoints).toEqual([]);
  });

  it('for a closed-weave curve, derives inner points from its own cellCorners/n instead of colors.length', () => {
    const cellCorners = [new Point(0, 0), new Point(9, 0), new Point(9, 9), new Point(0, 9)];
    const curve = new Curve(cellCorners, colorsOfLength(1), null, null, true, {
      cellCorners,
      n: 2,
      leap: 3,
      cellId: 'cell-1',
    });
    const { controlPoints, innerPoints } = nailPositionsForCurve(curve);
    expect(controlPoints).toBe(cellCorners);
    // n=2 inner nails per edge * 4 edges, regardless of colors.length being 1.
    expect(innerPoints).toHaveLength(2 * 4);
  });
});
