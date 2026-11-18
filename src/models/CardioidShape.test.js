import { describe, it, expect } from 'vitest';
import { CardioidShape } from './CardioidShape.js';
import { shapeFromJSON } from './shapeFromJSON.js';

const config = {
  id: 'c1', name: 'Half', nailCount: 48, layerCount: 2, leap: 1, multiplier: 2, radius: 1000,
  rangeStart: 1, rangeEnd: 24,
  colors: [{ color: '#ff0000', enabled: true }, { color: '#00ff00', enabled: false }],
};

describe('CardioidShape', () => {
  it('weaves only the visible thread range on every layer, so a saved half cardioid stays half on Arrange', () => {
    const shape = new CardioidShape(config);
    expect(shape.chords()).toHaveLength(24 * 2);
    expect(new Set(shape.chords().map((c) => c.layerIndex))).toEqual(new Set([0, 1]));
  });

  it('uses only enabled colors, like the Cardioid page does', () => {
    expect(new CardioidShape(config).chords().every((c) => c.color === '#ff0000')).toBe(true);
  });

  it('weaves every thread when no range is saved', () => {
    const shape = new CardioidShape({ ...config, rangeStart: null, rangeEnd: null, layerCount: 1 });
    expect(shape.chords()).toHaveLength(47); // thread 48 joins nail 0 to itself
  });

  it('centres its nails on the origin, so Arrange rotates it about its own middle', () => {
    const nails = new CardioidShape({ ...config, stretch: 1.5 }).resampledOutline();
    const cx = nails.reduce((s, p) => s + p.x, 0) / nails.length;
    const cy = nails.reduce((s, p) => s + p.y, 0) / nails.length;
    expect(cx).toBeCloseTo(0);
    expect(cy).toBeCloseTo(0);
  });

  it('round-trips through JSON as a cardioid, and older shapes without a kind still load as outlines', () => {
    const back = shapeFromJSON(JSON.parse(JSON.stringify(new CardioidShape({ ...config, stretch: 2, direction: 'ccw' }))));
    expect(back.kind).toBe('cardioid');
    expect(back.toJSON()).toEqual(new CardioidShape({ ...config, stretch: 2, direction: 'ccw' }).toJSON());
    const outline = shapeFromJSON({ id: 's', name: 'Rect', anchors: [{ x: 0, y: 0 }], nailCount: 4, leap: 1, colors: [] });
    expect(outline.kind).toBeUndefined();
    expect(outline.anchors).toHaveLength(1);
  });
});
