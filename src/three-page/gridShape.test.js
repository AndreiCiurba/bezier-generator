import { describe, it, expect } from 'vitest';
import { GRID_SHAPES, DEFAULT_GRID_SHAPE, GRID_SHAPE_LABELS, isValidGridShape } from './gridShape.js';

describe('isValidGridShape', () => {
  it('accepts every declared shape', () => {
    for (const shape of GRID_SHAPES) {
      expect(isValidGridShape(shape)).toBe(true);
    }
  });

  it('rejects anything else', () => {
    expect(isValidGridShape('pentagon')).toBe(false);
    expect(isValidGridShape('')).toBe(false);
    expect(isValidGridShape(undefined)).toBe(false);
  });
});

describe('DEFAULT_GRID_SHAPE / GRID_SHAPE_LABELS', () => {
  it('the default is one of the declared shapes', () => {
    expect(GRID_SHAPES).toContain(DEFAULT_GRID_SHAPE);
  });

  it('every shape has a label', () => {
    for (const shape of GRID_SHAPES) {
      expect(typeof GRID_SHAPE_LABELS[shape]).toBe('string');
      expect(GRID_SHAPE_LABELS[shape].length).toBeGreaterThan(0);
    }
  });
});
