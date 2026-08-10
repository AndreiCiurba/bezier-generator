import { describe, it, expect } from 'vitest';
import { strokeWeightForColorCount, BASELINE_COLOR_COUNT, BASELINE_STROKE_WEIGHT } from './strokeWeight.js';

describe('strokeWeightForColorCount', () => {
  it('is exactly the baseline weight at the baseline color count (8)', () => {
    expect(strokeWeightForColorCount(BASELINE_COLOR_COUNT)).toBe(BASELINE_STROKE_WEIGHT);
  });

  it('is thicker for fewer colors than baseline', () => {
    expect(strokeWeightForColorCount(2)).toBeGreaterThan(BASELINE_STROKE_WEIGHT);
    expect(strokeWeightForColorCount(1)).toBeGreaterThan(strokeWeightForColorCount(2));
  });

  it('doubles at 2 colors (a quarter of the baseline count)', () => {
    expect(strokeWeightForColorCount(2)).toBeCloseTo(BASELINE_STROKE_WEIGHT * 2, 5);
  });

  it('is thinner for more colors than baseline, monotonically decreasing', () => {
    const w10 = strokeWeightForColorCount(10);
    const w25 = strokeWeightForColorCount(25);
    expect(w10).toBeLessThan(BASELINE_STROKE_WEIGHT);
    expect(w25).toBeLessThan(w10);
  });

  it('tapers gently rather than collapsing toward zero at the high end', () => {
    // 25 colors should still be a clearly visible line, not a hairline.
    expect(strokeWeightForColorCount(25)).toBeGreaterThan(BASELINE_STROKE_WEIGHT * 0.4);
  });

  it('handles a non-positive count without producing Infinity/NaN', () => {
    expect(strokeWeightForColorCount(0)).toBe(BASELINE_STROKE_WEIGHT);
  });
});
