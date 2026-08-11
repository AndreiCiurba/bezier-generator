import { describe, it, expect } from 'vitest';
import { smoothFalloff, deformPoint, deformGrid } from './puppetWarp.js';
import { Point } from '../Point.js';
import { Pin } from '../../models/Pin.js';

function pin({ ref, pos, radius = 100, falloff = 1 }) {
  return new Pin({ id: 'p', referencePosition: ref, position: pos ?? ref, radius, falloff });
}

describe('smoothFalloff', () => {
  it('is 1 at distance 0', () => {
    expect(smoothFalloff(0, 100)).toBe(1);
  });

  it('is 0 at and beyond the radius', () => {
    expect(smoothFalloff(100, 100)).toBe(0);
    expect(smoothFalloff(150, 100)).toBe(0);
  });

  it('is monotonically decreasing between 0 and the radius', () => {
    const a = smoothFalloff(10, 100);
    const b = smoothFalloff(50, 100);
    const c = smoothFalloff(90, 100);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
  });

  it('is continuous - no jump approaching the radius from inside', () => {
    const justInside = smoothFalloff(99.9, 100);
    const atEdge = smoothFalloff(100, 100);
    expect(justInside - atEdge).toBeLessThan(0.01);
  });

  it('returns 0 for a non-positive radius rather than dividing by zero', () => {
    expect(smoothFalloff(5, 0)).toBe(0);
    expect(Number.isFinite(smoothFalloff(5, -10))).toBe(true);
  });

  it('a higher falloff exponent sharpens the cutoff (lower mid-range value)', () => {
    const soft = smoothFalloff(50, 100, 1);
    const sharp = smoothFalloff(50, 100, 4);
    expect(sharp).toBeLessThan(soft);
  });
});

describe('deformPoint', () => {
  it('returns an unchanged copy when no pins are given', () => {
    const base = new Point(10, 10);
    const result = deformPoint(base, []);
    expect(result).toEqual({ x: 10, y: 10 });
    expect(result).not.toBe(base);
  });

  it('returns an unchanged point when every pin is out of range', () => {
    const base = new Point(0, 0);
    const farPin = pin({ ref: { x: 1000, y: 1000 }, pos: { x: 1010, y: 1000 }, radius: 10 });
    expect(deformPoint(base, [farPin])).toEqual({ x: 0, y: 0 });
  });

  it('moves a point exactly at the pin by the full displacement vector', () => {
    const base = new Point(0, 0);
    const p = pin({ ref: { x: 0, y: 0 }, pos: { x: 20, y: -5 }, radius: 100 });
    const result = deformPoint(base, [p]);
    expect(result.x).toBeCloseTo(20, 5);
    expect(result.y).toBeCloseTo(-5, 5);
  });

  it('a stationary pin (position === referencePosition) contributes zero displacement', () => {
    const base = new Point(5, 0);
    const p = pin({ ref: { x: 0, y: 0 }, radius: 100 });
    expect(deformPoint(base, [p])).toEqual({ x: 5, y: 0 });
  });

  describe('single-pin falloff (regression: a lone pin used to ignore distance entirely)', () => {
    // A base point exactly half the radius away from the pin - smoothFalloff
    // works out to exactly 0.5 there (falloff=1, the default), so the point
    // should move exactly half the pin's own displacement, not the full
    // amount. Dragging the pin 10px should not drag every point within the
    // radius the full 10px - that was the bug: dividing by the *sum* of
    // weights (a single pin's weight, here) always cancels back to 1.0
    // regardless of distance, erasing the falloff before it ever mattered.
    it('a point at half the radius moves exactly half the pin displacement', () => {
      const base = new Point(50, 0); // 50 units from the pin, radius 100
      const p = pin({ ref: { x: 0, y: 0 }, pos: { x: 10, y: 0 }, radius: 100 });
      const result = deformPoint(base, [p]);
      expect(result.x).toBeCloseTo(50 + 5, 5); // half of the 10px pull
    });

    it('a point near the radius edge moves much less than one near the pin', () => {
      const p = pin({ ref: { x: 0, y: 0 }, pos: { x: 10, y: 0 }, radius: 100 });
      const near = deformPoint(new Point(5, 0), [p]);
      const far = deformPoint(new Point(90, 0), [p]);
      expect(near.x - 5).toBeGreaterThan(far.x - 90);
      expect(far.x - 90).toBeGreaterThan(0); // still pulled a little, just not much
    });
  });

  it('sums (not averages) two overlapping pins, capped at one full pin\'s worth of combined pull', () => {
    const base = new Point(0, 0);
    // Both pins reference the same point (equal weight 1 each, distance 0) -
    // combined weight is 2, which exceeds the cap, so each contributes half.
    const a = pin({ ref: { x: 0, y: 0 }, pos: { x: 10, y: 0 }, radius: 100 });
    const b = pin({ ref: { x: 0, y: 0 }, pos: { x: 0, y: 10 }, radius: 100 });
    const result = deformPoint(base, [a, b]);
    expect(result.x).toBeCloseTo(5, 5);
    expect(result.y).toBeCloseTo(5, 5);
  });

  it('does not inflate weak, non-overlapping pulls up to the cap', () => {
    const base = new Point(0, 0);
    // Two distant, weakly-reaching pins - their combined weight stays well
    // under 1, so neither should get boosted as if it were alone at full
    // strength.
    const a = pin({ ref: { x: 95, y: 0 }, pos: { x: 105, y: 0 }, radius: 100 }); // weight ~0
    const weightAtA = smoothFalloff(95, 100);
    const result = deformPoint(base, [a]);
    expect(result.x).toBeCloseTo(weightAtA * 10, 5);
    expect(weightAtA).toBeLessThan(0.1); // sanity: genuinely a weak pull, not near 1
  });
});

describe('deformGrid', () => {
  it('maps deformPoint over every base point, preserving order/length', () => {
    const base = [new Point(0, 0), new Point(10, 0), new Point(20, 0)];
    const result = deformGrid(base, []);
    expect(result).toHaveLength(3);
    expect(result).toEqual(base.map((p) => ({ x: p.x, y: p.y })));
  });
});
