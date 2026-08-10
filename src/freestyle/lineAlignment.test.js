import { describe, it, expect } from 'vitest';
import { isAxisAligned } from './lineAlignment.js';

describe('isAxisAligned', () => {
  it('is true for an exactly vertical line (same x)', () => {
    expect(isAxisAligned({ x: 10, y: 0 }, { x: 10, y: 50 }, 4)).toBe(true);
  });

  it('is true for an exactly horizontal line (same y)', () => {
    expect(isAxisAligned({ x: 0, y: 20 }, { x: 50, y: 20 }, 4)).toBe(true);
  });

  it('is true within tolerance, not just exact matches', () => {
    expect(isAxisAligned({ x: 10, y: 0 }, { x: 13, y: 50 }, 4)).toBe(true);
  });

  it('is false just outside tolerance', () => {
    expect(isAxisAligned({ x: 10, y: 0 }, { x: 15, y: 50 }, 4)).toBe(false);
  });

  it('is false for a diagonal line with no axis alignment at all', () => {
    expect(isAxisAligned({ x: 0, y: 0 }, { x: 50, y: 50 }, 4)).toBe(false);
  });

  it('is true when the two points coincide (both axes trivially aligned)', () => {
    expect(isAxisAligned({ x: 5, y: 5 }, { x: 5, y: 5 }, 4)).toBe(true);
  });
});
