import { describe, it, expect } from 'vitest';
import { CardioidShape } from './CardioidShape.js';
import { shapeFromJSON } from './shapeFromJSON.js';

const run = (changes) => ({ color: '#ff0000', enabled: true, rangeStart: 1, rangeEnd: 24, rotation: 0, multiplier: null, leap: null, ...changes });

const config = {
  id: 'c1', name: 'Hug', nailCount: 48, layerCount: 2, leap: 1, multiplier: 2, radius: 1000,
  runs: [run(), run({ color: '#00ff00', rangeStart: 24, rangeEnd: 47 })],
};

describe('CardioidShape', () => {
  it('weaves every run on every layer, so a saved run stack looks the same on Arrange', () => {
    const shape = new CardioidShape(config);
    expect(shape.chords()).toHaveLength((24 + 24) * 2);
    expect(new Set(shape.chords().map((c) => c.layerIndex))).toEqual(new Set([0, 1]));
    expect(new Set(shape.chords().map((c) => c.stackIndex))).toEqual(new Set([0, 1]));
  });

  it('marks the last chord of each run on each layer single', () => {
    expect(new CardioidShape(config).chords().filter((c) => c.single)).toHaveLength(2 * 2);
  });

  it('exposes one color per run, and recolors the runs through it - how Arrange swatches edit a placed cardioid', () => {
    const shape = new CardioidShape(config);
    expect(shape.colors).toEqual([{ color: '#ff0000', enabled: true }, { color: '#00ff00', enabled: true }]);
    shape.colors = [{ color: '#0000ff', enabled: true }, { color: '#00ff00', enabled: false }];
    expect(shape.chords().every((c) => c.color === '#0000ff')).toBe(true);
  });

  it('turns an old color-split cardioid into runs that weave the same threads in the same colors', () => {
    const legacy = new CardioidShape({
      id: 'old', name: 'Old', nailCount: 48, layerCount: 1, leap: 1, multiplier: 2, radius: 1000,
      rangeStart: 1, rangeEnd: 30,
      colors: [{ color: '#ff0000', enabled: true }, { color: '#00ff00', enabled: true }],
    });
    expect(legacy.runs.map((r) => [r.color, r.rangeStart, r.rangeEnd])).toEqual([['#ff0000', 1, 23], ['#00ff00', 24, 30]]);
    expect(legacy.chords()).toHaveLength(30);
  });

  it('centres its nails on the origin, so Arrange rotates it about its own middle', () => {
    const nails = new CardioidShape({ ...config, stretch: 1.5 }).resampledOutline();
    const cx = nails.reduce((s, p) => s + p.x, 0) / nails.length;
    const cy = nails.reduce((s, p) => s + p.y, 0) / nails.length;
    expect(cx).toBeCloseTo(0);
    expect(cy).toBeCloseTo(0);
  });

  it('round-trips through JSON as a cardioid with its runs, and older shapes without a kind still load as outlines', () => {
    const shape = new CardioidShape({ ...config, stretch: 2, direction: 'ccw', runGapMm: 0.8 });
    const back = shapeFromJSON(JSON.parse(JSON.stringify(shape)));
    expect(back.kind).toBe('cardioid');
    expect(back.toJSON()).toEqual(shape.toJSON());
    expect(back.runGapMm).toBe(0.8);
    const outline = shapeFromJSON({ id: 's', name: 'Rect', anchors: [{ x: 0, y: 0 }], nailCount: 4, leap: 1, colors: [] });
    expect(outline.kind).toBeUndefined();
    expect(outline.anchors).toHaveLength(1);
  });
});
