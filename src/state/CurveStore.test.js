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

describe('Curve#isClosedWeave / belongsToCell', () => {
  it('an ordinary curve is not a closed weave and belongs to no cell', () => {
    const curve = new Curve([], []);
    expect(curve.isClosedWeave).toBe(false);
    expect(curve.belongsToCell('cell-1')).toBe(false);
  });

  it('a closed-weave curve reports true and matches only its own cellId', () => {
    const closedWeave = { cellCorners: [], n: 8, leap: 3, cellId: 'cell-1' };
    const curve = new Curve([], [], null, null, true, closedWeave);
    expect(curve.isClosedWeave).toBe(true);
    expect(curve.belongsToCell('cell-1')).toBe(true);
    expect(curve.belongsToCell('cell-2')).toBe(false);
  });
});

describe('Curve id/visible', () => {
  it('every curve gets its own id', () => {
    const a = new Curve([], []);
    const b = new Curve([], []);
    expect(a.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
  });

  it('defaults to visible', () => {
    expect(new Curve([], []).visible).toBe(true);
  });

  it('an explicit visible value is honored', () => {
    expect(new Curve([], [], null, null, false).visible).toBe(false);
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

  it('hasCurveForCell / findByCellId only match closed-weave curves tagged with that cellId', () => {
    const store = new CurveStore();
    const weaveA = new Curve([], [], null, null, true, { cellCorners: [], n: 8, leap: 3, cellId: 'cell-1' });
    store.add(new Curve([], [])); // ordinary curve
    store.add(weaveA);

    expect(store.hasCurveForCell('cell-1')).toBe(true);
    expect(store.hasCurveForCell('cell-2')).toBe(false);
    expect(store.findByCellId('cell-1')).toBe(weaveA);
    expect(store.findByCellId('cell-2')).toBeNull();
  });

  it('weaveCellIds lists every closed-weave curve\'s cell id, ignoring ordinary curves - the Weave menu\'s "Select All" source list', () => {
    const store = new CurveStore();
    store.add(new Curve([], [])); // ordinary curve, no cell id at all
    store.add(new Curve([], [], null, null, true, { cellCorners: [], n: 8, leap: 3, cellId: 'cell-1' }));
    store.add(new Curve([], [], null, null, true, { cellCorners: [], n: 8, leap: 3, cellId: 'cell-2' }));

    expect(store.weaveCellIds()).toEqual(['cell-1', 'cell-2']);
  });

  it('visibleCurves reflects only currently-visible curves, in store order', () => {
    const store = new CurveStore();
    const a = new Curve([], []);
    const b = new Curve([], []);
    store.add(a);
    store.add(b);
    expect(store.visibleCurves).toEqual([a, b]);

    store.setVisible(a.id, false);
    expect(store.visibleCurves).toEqual([b]);
  });

  it('setVisible is a no-op for an unknown curve id', () => {
    const store = new CurveStore();
    const a = new Curve([], []);
    store.add(a);
    store.setVisible('does-not-exist', false);
    expect(a.visible).toBe(true);
  });

  it('onChange fires on add/undo/clear/setVisible, and the returned unsubscribe stops it', () => {
    const store = new CurveStore();
    let calls = 0;
    const unsubscribe = store.onChange(() => calls++);

    const a = new Curve([], []);
    store.add(a);
    expect(calls).toBe(1);

    store.setVisible(a.id, false);
    expect(calls).toBe(2);

    store.undo();
    expect(calls).toBe(3);

    store.clear();
    expect(calls).toBe(4);

    unsubscribe();
    store.add(new Curve([], []));
    expect(calls).toBe(4);
  });

  it('setVisible does not notify when the value is unchanged (already at that visibility)', () => {
    const store = new CurveStore();
    const a = new Curve([], []);
    store.add(a);
    let calls = 0;
    store.onChange(() => calls++);

    store.setVisible(a.id, true); // already true
    expect(calls).toBe(0);
  });
});
