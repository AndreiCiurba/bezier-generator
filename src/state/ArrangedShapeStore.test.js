import { describe, it, expect } from 'vitest';
import { ArrangedShapeStore } from './ArrangedShapeStore.js';
import { FreeformShape } from '../models/FreeformShape.js';
import { triangleAnchors } from '../core/shapePresets.js';

const colors = [{ color: '#ffffff', enabled: true }];

function makeSnapshot(id = 's1') {
  return new FreeformShape({ id, name: 'Triangle', anchors: triangleAnchors({ x: 0, y: 0 }, 10), nailCount: 15, leap: 2, colors });
}

describe('ArrangedShapeStore', () => {
  it('starts empty', () => {
    const store = new ArrangedShapeStore();
    expect(store.instances).toEqual([]);
    expect(store.count).toBe(0);
  });

  it('add places an instance and notifies listeners', () => {
    const store = new ArrangedShapeStore();
    let calls = 0;
    store.onChange(() => calls++);

    store.add({ id: 'i1', shapeId: 's1', shapeSnapshot: makeSnapshot(), position: { x: 5, y: 5 } });

    expect(store.count).toBe(1);
    expect(store.findById('i1').position).toEqual({ x: 5, y: 5 });
    expect(calls).toBe(1);
  });

  it('defaults rotation to 0 and scale to 1 when not given', () => {
    const store = new ArrangedShapeStore();
    store.add({ id: 'i1', shapeId: 's1', shapeSnapshot: makeSnapshot(), position: { x: 0, y: 0 } });
    const instance = store.findById('i1');
    expect(instance.rotationRadians).toBe(0);
    expect(instance.scale).toBe(1);
  });

  it('remove drops just the matching instance', () => {
    const store = new ArrangedShapeStore();
    store.add({ id: 'i1', shapeId: 's1', shapeSnapshot: makeSnapshot(), position: { x: 0, y: 0 } });
    store.add({ id: 'i2', shapeId: 's1', shapeSnapshot: makeSnapshot(), position: { x: 1, y: 1 } });

    store.remove('i1');

    expect(store.instances.map((i) => i.id)).toEqual(['i2']);
  });

  it('move/setRotation/setScale mutate just the matching instance', () => {
    const store = new ArrangedShapeStore();
    store.add({ id: 'i1', shapeId: 's1', shapeSnapshot: makeSnapshot(), position: { x: 0, y: 0 } });

    store.move('i1', { x: 10, y: 20 });
    store.setRotation('i1', Math.PI / 2);
    store.setScale('i1', 2.5);

    const instance = store.findById('i1');
    expect(instance.position).toEqual({ x: 10, y: 20 });
    expect(instance.rotationRadians).toBe(Math.PI / 2);
    expect(instance.scale).toBe(2.5);
  });

  it('setHeight overrides just that instance\'s own snapshot height', () => {
    const store = new ArrangedShapeStore();
    store.add({ id: 'i1', shapeId: 's1', shapeSnapshot: makeSnapshot(), position: { x: 0, y: 0 } });
    store.setHeight('i1', 42);
    expect(store.findById('i1').shapeSnapshot.height).toBe(42);
  });

  it('setWeight overrides just that instance\'s own snapshot weight', () => {
    const store = new ArrangedShapeStore();
    store.add({ id: 'i1', shapeId: 's1', shapeSnapshot: makeSnapshot(), position: { x: 0, y: 0 } });
    store.setWeight('i1', 0.03);
    expect(store.findById('i1').shapeSnapshot.weight).toBe(0.03);
  });

  it('clear empties the store', () => {
    const store = new ArrangedShapeStore();
    store.add({ id: 'i1', shapeId: 's1', shapeSnapshot: makeSnapshot(), position: { x: 0, y: 0 } });
    store.clear();
    expect(store.count).toBe(0);
  });

  describe('toJSON / importInstances round-trip', () => {
    it('reconstructs equivalent instances from exported JSON', () => {
      const store = new ArrangedShapeStore();
      store.add({ id: 'i1', shapeId: 's1', shapeSnapshot: makeSnapshot(), position: { x: 3, y: 4 }, rotationRadians: 1, scale: 2 });

      const restored = new ArrangedShapeStore();
      restored.importInstances(store.toJSON(), FreeformShape);

      expect(restored.toJSON()).toEqual(store.toJSON());
    });

    it('skips malformed entries missing required fields', () => {
      const store = new ArrangedShapeStore();
      store.importInstances([{ notAnInstance: true }], FreeformShape);
      expect(store.count).toBe(0);
    });
  });
});
