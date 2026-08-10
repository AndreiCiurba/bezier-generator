import { describe, it, expect } from 'vitest';
import { axisMisalignment, alignmentCloseness } from './lineAlignment.js';

describe('axisMisalignment', () => {
  it('is 0 for an exactly vertical line (same x)', () => {
    expect(axisMisalignment({ x: 10, y: 0 }, { x: 10, y: 50 })).toBe(0);
  });

  it('is 0 for an exactly horizontal line (same y)', () => {
    expect(axisMisalignment({ x: 0, y: 20 }, { x: 50, y: 20 })).toBe(0);
  });

  it('is the smaller of the x/y differences for a diagonal line', () => {
    expect(axisMisalignment({ x: 0, y: 0 }, { x: 30, y: 10 })).toBe(10);
    expect(axisMisalignment({ x: 0, y: 0 }, { x: 10, y: 30 })).toBe(10);
  });

  it('is 0 when the two points coincide', () => {
    expect(axisMisalignment({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });
});

describe('alignmentCloseness', () => {
  it('is 1 (fully aligned) at offset 0', () => {
    expect(alignmentCloseness(0, 50)).toBe(1);
  });

  it('is 0 (not aligned) at or beyond maxDistance', () => {
    expect(alignmentCloseness(50, 50)).toBe(0);
    expect(alignmentCloseness(100, 50)).toBe(0);
  });

  it('interpolates linearly in between', () => {
    expect(alignmentCloseness(25, 50)).toBeCloseTo(0.5, 5);
    expect(alignmentCloseness(10, 50)).toBeCloseTo(0.8, 5);
  });

  it('never goes negative for a huge offset', () => {
    expect(alignmentCloseness(1000, 50)).toBe(0);
  });

  it('treats a non-positive maxDistance as an exact on/off threshold at 0', () => {
    expect(alignmentCloseness(0, 0)).toBe(1);
    expect(alignmentCloseness(1, 0)).toBe(0);
  });
});
