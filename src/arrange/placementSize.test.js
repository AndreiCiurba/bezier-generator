import { describe, it, expect } from 'vitest';
import { shapeExtent, scaleForTargetSize } from './placementSize.js';

describe('shapeExtent', () => {
  it('measures the longest side of the bounding box, whichever axis it is on', () => {
    expect(shapeExtent([{ x: 0, y: 0 }, { x: 40, y: 10 }])).toBe(40);
    expect(shapeExtent([{ x: 5, y: -20 }, { x: 8, y: 30 }])).toBe(50);
  });

  it('is 0 for nothing to measure', () => {
    expect(shapeExtent([])).toBe(0);
  });
});

describe('scaleForTargetSize', () => {
  it('makes a small drawing and a big drawing of the same shape land at the same size', () => {
    expect(scaleForTargetSize(100, 1500) * 100).toBeCloseTo(1500);
    expect(scaleForTargetSize(900, 1500) * 900).toBeCloseTo(1500);
  });

  it('falls back to 1 rather than dividing by zero or a bad target', () => {
    expect(scaleForTargetSize(0, 1500)).toBe(1);
    expect(scaleForTargetSize(100, 0)).toBe(1);
  });
});
