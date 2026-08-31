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

  describe('Grid Shape: square tiled layout', () => {
    it("at N=13 produces exactly N^2 points - the same nail count as today's rectangular N x N triangular fill", () => {
      const grid = new Grid({ rows: 13, cols: 13, spacing: 60, layout: 'square' });
      expect(grid.points.length).toBe(13 * 13);
    });

    it('a larger N produces more points than a smaller one', () => {
      const small = new Grid({ rows: 5, cols: 5, spacing: 60, layout: 'square' }).points.length;
      const large = new Grid({ rows: 13, cols: 13, spacing: 60, layout: 'square' }).points.length;
      expect(large).toBeGreaterThan(small);
    });

    it('the smallest valid N (3) still produces a valid ring plus a center nail, with no crash', () => {
      const grid = new Grid({ rows: 3, cols: 3, spacing: 60, layout: 'square' });
      expect(grid.points.length).toBeGreaterThan(1);
    });

    it('is centered near the origin and bounded evenly on both axes (a true square, not a rectangle)', () => {
      const grid = new Grid({ rows: 13, cols: 13, spacing: 60, layout: 'square' });
      const box = grid.boundingBox();
      expect(box.width).toBeCloseTo(box.height, 5);
      expect(box.minX + box.width / 2).toBeCloseTo(0, 5);
      expect(box.minY + box.height / 2).toBeCloseTo(0, 5);
    });

    it('produces no duplicate points', () => {
      const grid = new Grid({ rows: 13, cols: 13, spacing: 60, layout: 'square' });
      const seen = new Set(grid.points.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`));
      expect(seen.size).toBe(grid.points.length);
    });

    it('is a real tiled lattice - every interior nail has 4 orthogonal neighbors at exactly one spacing away, forming an actual square', () => {
      // The whole point of this layout (see Grid.js#buildSquareTiled's own
      // doc) is that "the 4 nearest nails to a click" are always a genuine
      // axis-aligned unit square, unlike the old concentric-rings shape
      // where a click could land on 3 nearly-collinear points from one
      // ring's edge plus 1 from a completely different ring.
      const spacing = 60;
      const grid = new Grid({ rows: 5, cols: 5, spacing, layout: 'square' });
      const center = grid.points.find((p) => Math.abs(p.x) < 1e-6 && Math.abs(p.y) < 1e-6);
      expect(center).toBeDefined();

      const right = grid.points.find((p) => Math.abs(p.x - spacing) < 1e-6 && Math.abs(p.y) < 1e-6);
      const down = grid.points.find((p) => Math.abs(p.x) < 1e-6 && Math.abs(p.y - spacing) < 1e-6);
      const diagonal = grid.points.find((p) => Math.abs(p.x - spacing) < 1e-6 && Math.abs(p.y - spacing) < 1e-6);
      expect(right).toBeDefined();
      expect(down).toBeDefined();
      expect(diagonal).toBeDefined();

      // center-right-diagonal-down is a proper unit square: two sides of
      // length `spacing`, one diagonal of length `spacing * sqrt(2)`.
      expect(center.distanceTo(right)).toBeCloseTo(spacing, 5);
      expect(center.distanceTo(down)).toBeCloseTo(spacing, 5);
      expect(right.distanceTo(diagonal)).toBeCloseTo(spacing, 5);
      expect(down.distanceTo(diagonal)).toBeCloseTo(spacing, 5);
      expect(center.distanceTo(diagonal)).toBeCloseTo(spacing * Math.SQRT2, 5);
    });
  });

  describe('Grid Shape: hexagon (honeycomb) layout', () => {
    const rotatedConfig = { rows: 13, cols: 13, spacing: 60, rowHeight: (60 * Math.sqrt(3)) / 2 };

    it('keeps roughly 2/3 of the points the same N x N triangular lattice would have (1 of 3 sublattices removed)', () => {
      const triangle = new Grid({ ...rotatedConfig, layout: 'rotated' }).points.length;
      const hexagon = new Grid({ ...rotatedConfig, layout: 'hexagon' }).points.length;
      expect(hexagon).toBeLessThan(triangle);
      expect(hexagon / triangle).toBeGreaterThan(0.55);
      expect(hexagon / triangle).toBeLessThan(0.78);
    });

    it('is a true honeycomb: every interior nail has exactly 3 neighbors, all at exactly `spacing` distance', () => {
      const grid = new Grid({ ...rotatedConfig, layout: 'hexagon' });
      const spacing = 60;
      const box = grid.boundingBox();
      const margin = spacing * 2;

      // Only check nails safely away from the board edge - edge nails
      // legitimately have fewer than 3 neighbors (their would-be neighbors
      // fall outside the grid entirely), same as any lattice boundary.
      const interior = grid.points.filter(
        (p) => p.x > box.minX + margin && p.x < box.maxX - margin && p.y > box.minY + margin && p.y < box.maxY - margin
      );
      expect(interior.length).toBeGreaterThan(0);

      for (const p of interior) {
        const neighbors = grid.points.filter((other) => {
          if (other === p) return false;
          return Math.abs(Math.hypot(other.x - p.x, other.y - p.y) - spacing) < 1e-6;
        });
        expect(neighbors).toHaveLength(3);
      }
    });

    it('produces no duplicate points', () => {
      const grid = new Grid({ ...rotatedConfig, layout: 'hexagon' });
      const seen = new Set(grid.points.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`));
      expect(seen.size).toBe(grid.points.length);
    });

    it('a larger N produces more points than a smaller one', () => {
      const small = new Grid({ rows: 5, cols: 5, spacing: 60, rowHeight: (60 * Math.sqrt(3)) / 2, layout: 'hexagon' }).points.length;
      const large = new Grid({ ...rotatedConfig, layout: 'hexagon' }).points.length;
      expect(large).toBeGreaterThan(small);
    });
  });
});
