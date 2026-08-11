import { describe, it, expect } from 'vitest';
import {
  controlPointDiameterForColorCount,
  innerPointDiameterForColorCount,
  BASELINE_CONTROL_POINT_DIAMETER,
  BASELINE_INNER_POINT_DIAMETER,
} from './nailDotSize.js';

describe('controlPointDiameterForColorCount', () => {
  it('is exactly the baseline diameter at the baseline color count (8)', () => {
    expect(controlPointDiameterForColorCount(8)).toBe(BASELINE_CONTROL_POINT_DIAMETER);
  });

  it('is bigger for fewer colors, smaller for more', () => {
    const few = controlPointDiameterForColorCount(2);
    const many = controlPointDiameterForColorCount(20);
    expect(few).toBeGreaterThan(BASELINE_CONTROL_POINT_DIAMETER);
    expect(many).toBeLessThan(BASELINE_CONTROL_POINT_DIAMETER);
  });

  it('is monotonically decreasing as color count increases', () => {
    const d1 = controlPointDiameterForColorCount(4);
    const d2 = controlPointDiameterForColorCount(8);
    const d3 = controlPointDiameterForColorCount(16);
    expect(d1).toBeGreaterThan(d2);
    expect(d2).toBeGreaterThan(d3);
  });

  it('never shrinks below a still-visible minimum at the high end (25 colors)', () => {
    expect(controlPointDiameterForColorCount(25)).toBeGreaterThanOrEqual(3);
  });

  it('never blows up unreasonably large at the low end (1 color)', () => {
    // Plain inverse proportionality would give 80px here - clamped instead.
    expect(controlPointDiameterForColorCount(1)).toBeLessThanOrEqual(20);
  });

  it('handles a non-positive count without producing Infinity/NaN', () => {
    expect(controlPointDiameterForColorCount(0)).toBe(BASELINE_CONTROL_POINT_DIAMETER);
  });
});

describe('innerPointDiameterForColorCount', () => {
  it('is exactly the baseline diameter at the baseline color count (8)', () => {
    expect(innerPointDiameterForColorCount(8)).toBe(BASELINE_INNER_POINT_DIAMETER);
  });

  it('is always smaller than the control-point diameter at the same color count', () => {
    for (const count of [1, 2, 8, 16, 25]) {
      expect(innerPointDiameterForColorCount(count)).toBeLessThan(controlPointDiameterForColorCount(count));
    }
  });

  it('is clamped at both ends', () => {
    expect(innerPointDiameterForColorCount(1)).toBeLessThanOrEqual(8);
    expect(innerPointDiameterForColorCount(25)).toBeGreaterThanOrEqual(1.5);
  });
});
