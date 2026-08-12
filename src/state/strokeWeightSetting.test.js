import { describe, it, expect } from 'vitest';
import { parseStrokeWeight, MIN_STROKE_WEIGHT, MAX_STROKE_WEIGHT } from './strokeWeightSetting.js';

describe('parseStrokeWeight', () => {
  it('accepts a value within range', () => {
    expect(parseStrokeWeight('0.6')).toBe(0.6);
    expect(parseStrokeWeight(3)).toBe(3);
  });

  it('rejects non-numeric input', () => {
    expect(parseStrokeWeight('abc')).toBeNull();
    expect(parseStrokeWeight('')).toBeNull();
  });

  it('rejects out-of-range input', () => {
    expect(parseStrokeWeight(MIN_STROKE_WEIGHT - 0.05)).toBeNull();
    expect(parseStrokeWeight(MAX_STROKE_WEIGHT + 1)).toBeNull();
  });

  it('accepts the boundary values', () => {
    expect(parseStrokeWeight(MIN_STROKE_WEIGHT)).toBe(MIN_STROKE_WEIGHT);
    expect(parseStrokeWeight(MAX_STROKE_WEIGHT)).toBe(MAX_STROKE_WEIGHT);
  });

  it('rejects zero (a real thread has some thickness)', () => {
    expect(parseStrokeWeight(0)).toBeNull();
  });
});
