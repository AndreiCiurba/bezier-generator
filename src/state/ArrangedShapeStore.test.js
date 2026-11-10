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

  describe('instance names', () => {
    const place = (store, id) => store.add({ id, shapeId: 's1', shapeSnapshot: makeSnapshot(), position: { x: 0, y: 0 } });

    it('names placed shapes <shape name>_<n> counting up from 1', () => {
      const store = new ArrangedShapeStore();
      place(store, 'a');
      place(store, 'b');
      expect(store.instances.map((i) => i.name)).toEqual(['Triangle_1', 'Triangle_2']);
    });

    it('never reuses a number still in use after a delete, so two shapes cannot share a name', () => {
      const store = new ArrangedShapeStore();
      place(store, 'a');
      place(store, 'b');
      store.remove('a');
      place(store, 'c');
      expect(store.instances.map((i) => i.name)).toEqual(['Triangle_2', 'Triangle_3']);
    });

    it('keeps names through a JSON round trip and names legacy entries that have none', () => {
      const store = new ArrangedShapeStore();
      place(store, 'a');
      const legacy = store.toJSON().map(({ name, ...rest }) => rest);

      const restored = new ArrangedShapeStore();
      restored.importInstances(store.toJSON(), FreeformShape);
      expect(restored.instances[0].name).toBe('Triangle_1');

      const fromLegacy = new ArrangedShapeStore();
      fromLegacy.importInstances(legacy, FreeformShape);
      expect(fromLegacy.instances[0].name).toBe('Triangle_1');
    });
  });

  describe('nail settings', () => {
    it('defaults to following the global nail visibility at scale 1', () => {
      const store = new ArrangedShapeStore();
      store.add({ id: 'a', shapeId: 's1', shapeSnapshot: makeSnapshot(), position: { x: 0, y: 0 } });
      expect(store.findById('a').nailsVisible).toBeNull();
      expect(store.findById('a').nailScale).toBe(1);
    });

    it('stores per-instance visibility and scale, and persists them', () => {
      const store = new ArrangedShapeStore();
      store.add({ id: 'a', shapeId: 's1', shapeSnapshot: makeSnapshot(), position: { x: 0, y: 0 } });
      store.setNailsVisible('a', false);
      store.setNailScale('a', 2.5);

      const restored = new ArrangedShapeStore();
      restored.importInstances(store.toJSON(), FreeformShape);
      expect(restored.findById('a').nailsVisible).toBe(false);
      expect(restored.findById('a').nailScale).toBe(2.5);
    });
  });

  describe('fit layers to nails', () => {
    it('is on for center-out shapes and off for old-rule shapes, so saved arrangements keep their look', () => {
      const store = new ArrangedShapeStore();
      const center = FreeformShape.fromJSON({ ...makeSnapshot().toJSON(), weaveRule: 'center' });
      store.add({ id: 'c', shapeId: 's1', shapeSnapshot: center, position: { x: 0, y: 0 } });
      store.add({ id: 'l', shapeId: 's1', shapeSnapshot: makeSnapshot(), position: { x: 0, y: 0 } });
      expect(store.findById('c').fitLayersToNails).toBe(true);
      expect(store.findById('l').fitLayersToNails).toBe(false);
    });

    it('can be switched per instance and survives export/import', () => {
      const store = new ArrangedShapeStore();
      store.add({ id: 'a', shapeId: 's1', shapeSnapshot: makeSnapshot(), position: { x: 0, y: 0 } });
      store.setFitLayersToNails('a', true);
      const restored = new ArrangedShapeStore();
      restored.importInstances(store.toJSON(), FreeformShape);
      expect(restored.findById('a').fitLayersToNails).toBe(true);
    });
  });

  describe('setColors', () => {
    it('recolors just that instance, leaving the library shape and other instances alone', () => {
      const source = makeSnapshot();
      const store = new ArrangedShapeStore();
      store.add({ id: 'a', shapeId: 's1', shapeSnapshot: FreeformShape.fromJSON(source.toJSON()), position: { x: 0, y: 0 } });
      store.add({ id: 'b', shapeId: 's1', shapeSnapshot: FreeformShape.fromJSON(source.toJSON()), position: { x: 0, y: 0 } });

      store.setColors('a', [{ color: '#123456', enabled: false }, { color: '#654321', enabled: true }]);

      expect(store.findById('a').shapeSnapshot.colors).toEqual([
        { color: '#123456', enabled: false },
        { color: '#654321', enabled: true },
      ]);
      expect(store.findById('b').shapeSnapshot.colors).toEqual(colors);
      expect(source.colors).toEqual(colors);
    });

    it('survives a JSON round trip so a recolor is saved with the arrangement', () => {
      const store = new ArrangedShapeStore();
      store.add({ id: 'a', shapeId: 's1', shapeSnapshot: makeSnapshot(), position: { x: 0, y: 0 } });
      store.setColors('a', [{ color: '#abcdef', enabled: true }]);

      const restored = new ArrangedShapeStore();
      restored.importInstances(store.toJSON(), FreeformShape);
      expect(restored.findById('a').shapeSnapshot.colors).toEqual([{ color: '#abcdef', enabled: true }]);
    });
  });
});
