import { describe, it, expect } from 'vitest';
import { CurveStore } from './CurveStore.js';
import { Curve } from '../models/Curve.js';

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
