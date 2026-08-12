import { describe, it, expect } from 'vitest';
import { normalizedColorLayerHeight, worldColorLayerHeight } from './curveZLayers.js';

describe('normalizedColorLayerHeight', () => {
  it('matches the confirmed spec exactly: 10 colors -> layer 0 at 1/11, layer 1 at 2/11, ..., layer 9 at 10/11', () => {
    expect(normalizedColorLayerHeight(0, 10)).toBeCloseTo(1 / 11, 10);
    expect(normalizedColorLayerHeight(1, 10)).toBeCloseTo(2 / 11, 10);
    expect(normalizedColorLayerHeight(9, 10)).toBeCloseTo(10 / 11, 10);
  });

  it('the last layer always stays strictly below 1 (the nail tip), regardless of count', () => {
    for (const count of [1, 2, 5, 25]) {
      const height = normalizedColorLayerHeight(count - 1, count);
      expect(height).toBeLessThan(1);
      expect(height).toBeCloseTo(count / (count + 1), 10);
    }
  });

  it('the first layer always stays strictly above 0 (the board), regardless of count', () => {
    for (const count of [1, 2, 5, 25]) {
      const height = normalizedColorLayerHeight(0, count);
      expect(height).toBeGreaterThan(0);
      expect(height).toBeCloseTo(1 / (count + 1), 10);
    }
  });

  it('a single-color curve sits exactly halfway between the board and the nail tip', () => {
    expect(normalizedColorLayerHeight(0, 1)).toBeCloseTo(0.5, 10);
  });

  it('the margin below the first layer equals the margin above the last layer (both are one division of N+1)', () => {
    for (const count of [1, 3, 8, 17]) {
      const marginBelowFirst = normalizedColorLayerHeight(0, count);
      const marginAboveLast = 1 - normalizedColorLayerHeight(count - 1, count);
      expect(marginAboveLast).toBeCloseTo(marginBelowFirst, 10);
    }
  });
});

describe('worldColorLayerHeight', () => {
  it('maps the normalized height into an arbitrary [minHeight, maxHeight] range', () => {
    expect(worldColorLayerHeight(0, 10, 0, 40)).toBeCloseTo((1 / 11) * 40, 10);
    expect(worldColorLayerHeight(9, 10, 0, 40)).toBeCloseTo((10 / 11) * 40, 10);
  });

  it('two different curves with the same color count and layer index land at the identical world height', () => {
    // The whole point of this model: height depends only on (index, count),
    // never on which curve or how many curves exist.
    const heightForCurveA = worldColorLayerHeight(2, 8, 0, 40);
    const heightForCurveB = worldColorLayerHeight(2, 8, 0, 40);
    expect(heightForCurveA).toBe(heightForCurveB);
  });
});
