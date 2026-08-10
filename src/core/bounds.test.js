import { describe, it, expect } from 'vitest';
import { isWithinBounds } from './bounds.js';

describe('isWithinBounds', () => {
  it('accepts a point inside the rectangle', () => {
    expect(isWithinBounds({ x: 50, y: 50 }, 100, 100)).toBe(true);
  });

  it('accepts points exactly on the edges (inclusive)', () => {
    expect(isWithinBounds({ x: 0, y: 0 }, 100, 100)).toBe(true);
    expect(isWithinBounds({ x: 100, y: 100 }, 100, 100)).toBe(true);
    expect(isWithinBounds({ x: 0, y: 100 }, 100, 100)).toBe(true);
  });

  it('rejects points outside on any side', () => {
    expect(isWithinBounds({ x: -1, y: 50 }, 100, 100)).toBe(false);
    expect(isWithinBounds({ x: 50, y: -1 }, 100, 100)).toBe(false);
    expect(isWithinBounds({ x: 101, y: 50 }, 100, 100)).toBe(false);
    expect(isWithinBounds({ x: 50, y: 101 }, 100, 100)).toBe(false);
  });

  it('rejects a point far outside, like a stray click on the burger menu', () => {
    expect(isWithinBounds({ x: -310, y: -220 }, 600, 400)).toBe(false);
  });
});
