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

  describe('boundingBox', () => {
    it('spans exactly from the min to the max point on each axis', () => {
      const grid = new Grid(config);
      grid.points.length = 0;
      grid.points.push(new Point(10, 100), new Point(50, 20), new Point(30, 60));

      expect(grid.boundingBox()).toEqual({ minX: 10, minY: 20, maxX: 50, maxY: 100, width: 40, height: 80 });
    });

    it('produces a wide box for many rows and few cols, and a tall one for the reverse', () => {
      const wide = new Grid({ ...config, rows: 15, cols: 2 });
      const tall = new Grid({ ...config, rows: 2, cols: 15 });

      expect(wide.boundingBox().width).toBeGreaterThan(wide.boundingBox().height);
      expect(tall.boundingBox().height).toBeGreaterThan(tall.boundingBox().width);
    });

    it('returns a degenerate zero box for an empty grid rather than +/-Infinity', () => {
      const grid = new Grid(config);
      grid.points.length = 0;
      expect(grid.boundingBox()).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 });
    });
  });
});
