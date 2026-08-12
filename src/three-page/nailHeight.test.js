import { describe, it, expect } from 'vitest';
import { parseNailHeight, MIN_NAIL_HEIGHT, MAX_NAIL_HEIGHT, DEFAULT_NAIL_HEIGHT } from './nailHeight.js';

describe('parseNailHeight', () => {
  it('accepts values within [MIN_NAIL_HEIGHT, MAX_NAIL_HEIGHT]', () => {
    expect(parseNailHeight(MIN_NAIL_HEIGHT)).toBe(MIN_NAIL_HEIGHT);
    expect(parseNailHeight(MAX_NAIL_HEIGHT)).toBe(MAX_NAIL_HEIGHT);
    expect(parseNailHeight(DEFAULT_NAIL_HEIGHT)).toBe(DEFAULT_NAIL_HEIGHT);
  });

  it('rejects out-of-range or non-numeric input', () => {
    expect(parseNailHeight(MIN_NAIL_HEIGHT - 1)).toBeNull();
    expect(parseNailHeight(MAX_NAIL_HEIGHT + 1)).toBeNull();
    expect(parseNailHeight('abc')).toBeNull();
    expect(parseNailHeight('')).toBeNull();
  });
});
