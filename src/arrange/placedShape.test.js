import { describe, it, expect } from 'vitest';
import { placedNails, placedSegments, shapeRadius } from './placedShape.js';
import { CardioidShape } from '../models/CardioidShape.js';
import { FreeformShape } from '../models/FreeformShape.js';
import { rectAnchors } from '../core/shapePresets.js';

const colors = [{ color: '#ff0000', enabled: true }];
const cardioid = new CardioidShape({
  id: 'c', name: 'C', nailCount: 12, layerCount: 3, leap: 1, multiplier: 2, radius: 100, colors,
});
const place = (shapeSnapshot, extra = {}) => ({ shapeSnapshot, position: { x: 500, y: 300 }, rotationRadians: 0, scale: 2, ...extra });

describe('placedNails', () => {
  it('moves and scales a cardioid about its own centre, so position means where its middle sits', () => {
    const nails = placedNails(place(cardioid));
    expect(nails[0].x).toBeCloseTo(500);
    expect(nails[0].y).toBeCloseTo(300 - 200); // nail 0 at the top, radius 100 x scale 2
  });

  it('rotates a cardioid with the instance rotation', () => {
    const nails = placedNails(place(cardioid, { rotationRadians: Math.PI / 2 }));
    expect(nails[0].x).toBeCloseTo(500 + 200);
    expect(nails[0].y).toBeCloseTo(300);
  });

  it('still resamples an outline shape to its own nail count', () => {
    const rect = new FreeformShape({ id: 'r', name: 'R', anchors: rectAnchors({ x: 0, y: 0 }, 10), nailCount: 8, leap: 2, colors });
    expect(placedNails(place(rect))).toHaveLength(8);
  });
});

describe('placedSegments', () => {
  it('gives a cardioid one string per thread per layer, tagged with its layer for stacking', () => {
    const segments = placedSegments(place(cardioid));
    expect(segments).toHaveLength(cardioid.chords().length);
    expect(Math.max(...segments.map((s) => s.layerIndex))).toBe(2);
  });
});

describe('shapeRadius', () => {
  it('is the cardioid circle radius, so clicking anywhere on it selects it', () => {
    expect(shapeRadius(cardioid)).toBeCloseTo(100);
  });
});
