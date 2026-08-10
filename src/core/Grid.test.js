import { describe, it, expect } from 'vitest';
import { Grid } from './Grid.js';
import { Point } from './Point.js';

const config = { rows: 15, cols: 13, spacing: 60, rowHeight: (60 * Math.sqrt(3)) / 2 };

describe('Grid', () => {
  it('generates a non-empty rotated lattice by default', () => {
    const grid = new Grid(config);
    expect(grid.points.length).toBeGreaterThan(0);
  });

  it('standard and rotated layouts produce the same point count', () => {
    const rotated = new Grid({ ...config, layout: 'rotated' });
    const standard = new Grid({ ...config, layout: 'standard' });
    expect(rotated.points.length).toBe(standard.points.length);
  });

  it('findNearestPoint returns the truly nearest point, not just the first match within range', () => {
    const grid = new Grid(config);
    // Two synthetic points where the *first* one in the array is farther away
    // than the second - this is exactly the case the original "first match
    // within 10px, then break" loop got wrong.
    grid.points.length = 0;
    grid.points.push(new Point(0, 8), new Point(0, 2));

    const nearest = grid.findNearestPoint(new Point(0, 0), 10);
    expect(nearest).toBe(grid.points[1]);
  });

  it('returns null when nothing is within range, instead of throwing', () => {
    const grid = new Grid(config);
    grid.points.length = 0;
    grid.points.push(new Point(1000, 1000));

    expect(grid.findNearestPoint(new Point(0, 0), 10)).toBeNull();
  });
});
