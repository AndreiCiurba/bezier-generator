import { describe, it, expect } from 'vitest';
import { parseGridSize, MIN_GRID_SIZE, MAX_GRID_SIZE, GRID_SIZE_PRESETS, DEFAULT_GRID_SIZE } from './gridSize.js';

describe('parseGridSize', () => {
  it('accepts integers within [MIN_GRID_SIZE, MAX_GRID_SIZE]', () => {
    expect(parseGridSize(MIN_GRID_SIZE)).toBe(MIN_GRID_SIZE);
    expect(parseGridSize(MAX_GRID_SIZE)).toBe(MAX_GRID_SIZE);
    expect(parseGridSize('13')).toBe(13);
  });

  it('rounds a non-integer to the nearest whole number', () => {
    expect(parseGridSize(12.6)).toBe(13);
  });

  it('rejects out-of-range or non-numeric input', () => {
    expect(parseGridSize(MIN_GRID_SIZE - 1)).toBeNull();
    expect(parseGridSize(MAX_GRID_SIZE + 1)).toBeNull();
    expect(parseGridSize('abc')).toBeNull();
    expect(parseGridSize('')).toBeNull();
  });
});

describe('GRID_SIZE_PRESETS / DEFAULT_GRID_SIZE', () => {
  it('every preset is a valid size, and the default is one of the presets', () => {
    for (const preset of GRID_SIZE_PRESETS) {
      expect(parseGridSize(preset)).toBe(preset);
    }
    expect(GRID_SIZE_PRESETS).toContain(DEFAULT_GRID_SIZE);
  });
});
