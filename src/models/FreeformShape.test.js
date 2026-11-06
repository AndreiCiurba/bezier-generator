import { describe, it, expect } from 'vitest';
import { FreeformShape } from './FreeformShape.js';
import { triangleAnchors } from '../core/shapePresets.js';
import { resampleClosedOutline } from '../core/bezierOutline.js';

const colors = [{ color: '#ffffff', enabled: true }];

function makeShape(overrides = {}) {
  return new FreeformShape({
    id: 's1',
    name: 'Triangle',
    anchors: triangleAnchors({ x: 0, y: 0 }, 10),
    nailCount: 15,
    leap: 2,
    colors,
    ...overrides,
  });
}

describe('FreeformShape#resampledOutline', () => {
  it('delegates to resampleClosedOutline with its own anchors/nailCount', () => {
    const shape = makeShape();
    expect(shape.resampledOutline()).toEqual(resampleClosedOutline(shape.anchors, shape.nailCount));
  });

  it('returns exactly nailCount points', () => {
    const shape = makeShape({ nailCount: 42 });
    expect(shape.resampledOutline()).toHaveLength(42);
  });
});

describe('FreeformShape construction', () => {
  it('deep-copies its anchors so later mutation of the source array does not alias the shape', () => {
    const anchors = triangleAnchors({ x: 0, y: 0 }, 10);
    const shape = makeShape({ anchors });
    anchors[0].x = 999;
    expect(shape.anchors[0].x).not.toBe(999);
  });

  it('deep-copies its colors so a second shape built from the same array never aliases this one\'s', () => {
    const sharedColors = [{ color: '#ffffff', enabled: true }];
    const shape = makeShape({ colors: sharedColors });
    sharedColors[0].color = '#000000';
    expect(shape.colors[0].color).toBe('#ffffff');
  });

  it('defaults height to null (use the board global) when not given', () => {
    const shape = makeShape();
    expect(shape.height).toBeNull();
  });

  it('keeps an explicit height override', () => {
    const shape = makeShape({ height: 25 });
    expect(shape.height).toBe(25);
  });

  it('defaults weight to null (use the board global) when not given', () => {
    const shape = makeShape();
    expect(shape.weight).toBeNull();
  });

  it('keeps an explicit weight override', () => {
    const shape = makeShape({ weight: 0.05 });
    expect(shape.weight).toBe(0.05);
  });
});

describe('FreeformShape JSON round-trip', () => {
  it('fromJSON(shape.toJSON()) reconstructs an equivalent shape', () => {
    const shape = makeShape({ height: 30, weight: 0.05 });
    const restored = FreeformShape.fromJSON(shape.toJSON());
    expect(restored.toJSON()).toEqual(shape.toJSON());
  });

  it('fromJSON defaults a missing height/weight to null', () => {
    const raw = makeShape().toJSON();
    delete raw.height;
    delete raw.weight;
    const restored = FreeformShape.fromJSON(raw);
    expect(restored.height).toBeNull();
    expect(restored.weight).toBeNull();
  });
});
