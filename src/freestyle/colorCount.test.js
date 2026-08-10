import { describe, it, expect } from 'vitest';
import { parseColorCount, MIN_COLORS, MAX_COLORS } from './colorCount.js';

describe('parseColorCount', () => {
  it('accepts values within range', () => {
    expect(parseColorCount('5')).toBe(5);
    expect(parseColorCount(12)).toBe(12);
  });

  it('accepts the boundary values', () => {
    expect(parseColorCount(MIN_COLORS)).toBe(MIN_COLORS);
    expect(parseColorCount(MAX_COLORS)).toBe(MAX_COLORS);
  });

  it('rejects values below the minimum', () => {
    expect(parseColorCount(MIN_COLORS - 1)).toBeNull();
    expect(parseColorCount(0)).toBeNull();
  });

  it('rejects values above the maximum', () => {
    expect(parseColorCount(MAX_COLORS + 1)).toBeNull();
  });

  it('rounds non-integer input', () => {
    expect(parseColorCount('5.6')).toBe(6);
  });

  it('rejects non-numeric input', () => {
    expect(parseColorCount('abc')).toBeNull();
    expect(parseColorCount('')).toBeNull();
  });
});
