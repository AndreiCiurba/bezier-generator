import { describe, it, expect } from 'vitest';
import { strokeWeightForColorCount, BASELINE_COLOR_COUNT, BASELINE_STROKE_WEIGHT } from './strokeWeight.js';

describe('strokeWeightForColorCount', () => {
  it('is exactly the baseline weight at the baseline color count (8)', () => {
    expect(strokeWeightForColorCount(BASELINE_COLOR_COUNT)).toBe(BASELINE_STROKE_WEIGHT);
  });

  it('doubles the color count -> halves the weight (and vice versa)', () => {
    expect(strokeWeightForColorCount(16)).toBeCloseTo(BASELINE_STROKE_WEIGHT / 2, 5);
    expect(strokeWeightForColorCount(4)).toBeCloseTo(BASELINE_STROKE_WEIGHT * 2, 5);
  });

  it('quadruples at 2 colors, a quarter of baseline', () => {
    expect(strokeWeightForColorCount(2)).toBeCloseTo(BASELINE_STROKE_WEIGHT * 4, 5);
  });

  it('is monotonically decreasing as color count increases, with a clearly visible drop by 25', () => {
    const w10 = strokeWeightForColorCount(10);
    const w25 = strokeWeightForColorCount(25);
    expect(w10).toBeLessThan(BASELINE_STROKE_WEIGHT);
    expect(w25).toBeLessThan(w10);
    // Should read as a real, noticeable thinning by the top of the range,
    // not a barely-perceptible one - roughly a third of baseline at 25.
    expect(w25).toBeLessThan(BASELINE_STROKE_WEIGHT * 0.35);
  });

  it('handles a non-positive count without producing Infinity/NaN', () => {
    expect(strokeWeightForColorCount(0)).toBe(BASELINE_STROKE_WEIGHT);
  });
});
