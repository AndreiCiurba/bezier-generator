import { describe, it, expect } from 'vitest';
import { CurveStore } from './CurveStore.js';
import { Curve } from '../models/Curve.js';
import { strokeWeightForColorCount } from '../core/strokeWeight.js';

describe('Curve#renderWeight', () => {
  it('falls back to strokeWeightForColorCount(colors.length) when no explicit weight was given', () => {
    const colors = [{ color: '#fff', enabled: true }, { color: '#000', enabled: true }];
    const curve = new Curve([], colors);
    expect(curve.renderWeight).toBe(strokeWeightForColorCount(2));
  });

  it('uses the explicit weight when one was given, ignoring color count entirely', () => {
    const colors = [{ color: '#fff', enabled: true }];
    const curve = new Curve([], colors, null, 5);
    expect(curve.renderWeight).toBe(5);
  });

  it('an explicit weight of 0 is honored, not treated as "unset" (nullish coalescing, not ||)', () => {
    const curve = new Curve([], [{ color: '#fff', enabled: true }], null, 0);
    expect(curve.renderWeight).toBe(0);
  });
});

describe('Curve#belongsToPattern', () => {
  it('is false for manual curves (patternId null) regardless of what is compared against', () => {
    const curve = new Curve([], []);
    expect(curve.belongsToPattern(null)).toBe(false);
    expect(curve.belongsToPattern('anything')).toBe(false);
  });

  it('is true only for a matching, non-null patternId', () => {
    const curve = new Curve([], [], 'p1');
    expect(curve.belongsToPattern('p1')).toBe(true);
    expect(curve.belongsToPattern('p2')).toBe(false);
  });
});

describe('CurveStore', () => {
  it('add/undo/clear', () => {
    const store = new CurveStore();
    const a = new Curve([], []);
    const b = new Curve([], []);
    store.add(a);
    store.add(b);
    expect(store.count).toBe(2);

    expect(store.undo()).toBe(b);
    expect(store.count).toBe(1);

    store.clear();
    expect(store.count).toBe(0);
  });

  it('hasCurveForPattern / curvesForPattern only match tagged curves', () => {
    const store = new CurveStore();
    store.add(new Curve([], [])); // manual
    store.add(new Curve([], [], 'p1'));
    store.add(new Curve([], [], 'p1'));
    store.add(new Curve([], [], 'p2'));

    expect(store.hasCurveForPattern('p1')).toBe(true);
    expect(store.hasCurveForPattern('p3')).toBe(false);
    expect(store.curvesForPattern('p1')).toHaveLength(2);
  });
});
