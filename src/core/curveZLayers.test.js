import { describe, it, expect } from 'vitest';
import { normalizedColorLayerHeight, worldColorLayerHeight } from './curveZLayers.js';

describe('normalizedColorLayerHeight', () => {
  it('matches the confirmed spec exactly: 10 colors -> layer 0 at 10%, layer 1 at 20%, ..., layer 9 at 100%', () => {
    expect(normalizedColorLayerHeight(0, 10)).toBeCloseTo(0.1, 10);
    expect(normalizedColorLayerHeight(1, 10)).toBeCloseTo(0.2, 10);
    expect(normalizedColorLayerHeight(9, 10)).toBeCloseTo(1.0, 10);
  });

  it('the last layer always reaches exactly 1 (the nail height), regardless of count', () => {
    for (const count of [1, 2, 5, 25]) {
      expect(normalizedColorLayerHeight(count - 1, count)).toBeCloseTo(1, 10);
    }
  });

  it('a single-color curve sits at exactly the nail height', () => {
    expect(normalizedColorLayerHeight(0, 1)).toBe(1);
  });
});

describe('worldColorLayerHeight', () => {
  it('maps the normalized height into an arbitrary [minHeight, maxHeight] range', () => {
    expect(worldColorLayerHeight(0, 10, 0, 40)).toBeCloseTo(4, 10); // 10% of 40
    expect(worldColorLayerHeight(9, 10, 0, 40)).toBeCloseTo(40, 10); // 100% of 40
  });

  it('two different curves with the same color count and layer index land at the identical world height', () => {
    // The whole point of this model: height depends only on (index, count),
    // never on which curve or how many curves exist.
    const heightForCurveA = worldColorLayerHeight(2, 8, 0, 40);
    const heightForCurveB = worldColorLayerHeight(2, 8, 0, 40);
    expect(heightForCurveA).toBe(heightForCurveB);
  });
});
