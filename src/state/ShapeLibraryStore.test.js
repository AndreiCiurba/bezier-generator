import { describe, it, expect } from 'vitest';
import { ShapeLibraryStore } from './ShapeLibraryStore.js';
import { FreeformShape } from '../models/FreeformShape.js';
import { triangleAnchors } from '../core/shapePresets.js';

const colors = [{ color: '#ffffff', enabled: true }];

function makeShape(id, name = id) {
  return new FreeformShape({
    id,
    name,
    anchors: triangleAnchors({ x: 0, y: 0 }, 10),
    nailCount: 15,
    leap: 2,
    colors,
  });
}

describe('ShapeLibraryStore', () => {
  it('starts empty', () => {
    const store = new ShapeLibraryStore();
    expect(store.shapes).toEqual([]);
    expect(store.count).toBe(0);
  });

  it('add appends a shape and notifies listeners', () => {
    const store = new ShapeLibraryStore();
    let calls = 0;
    store.onChange(() => calls++);

    store.add(makeShape('s1'));

    expect(store.count).toBe(1);
    expect(calls).toBe(1);
  });

  it('findById returns the matching shape, or null', () => {
    const store = new ShapeLibraryStore();
    const shape = makeShape('s1');
    store.add(shape);
    expect(store.findById('s1')).toBe(shape);
    expect(store.findById('missing')).toBeNull();
  });

  it('remove drops just the matching shape and notifies', () => {
    const store = new ShapeLibraryStore();
    store.add(makeShape('s1'));
    store.add(makeShape('s2'));
    let calls = 0;
    store.onChange(() => calls++);

    store.remove('s1');

    expect(store.shapes.map((s) => s.id)).toEqual(['s2']);
    expect(calls).toBe(1);
  });

  it('remove is a no-op for an id that does not exist', () => {
    const store = new ShapeLibraryStore();
    store.add(makeShape('s1'));
    let calls = 0;
    store.onChange(() => calls++);

    store.remove('missing');

    expect(store.count).toBe(1);
    expect(calls).toBe(0);
  });

  it('rename updates the shape name and notifies', () => {
    const store = new ShapeLibraryStore();
    store.add(makeShape('s1', 'Old Name'));

    store.rename('s1', 'New Name');

    expect(store.findById('s1').name).toBe('New Name');
  });

  it('clear drops every shape and notifies', () => {
    const store = new ShapeLibraryStore();
    store.add(makeShape('s1'));
    store.add(makeShape('s2'));
    let calls = 0;
    store.onChange(() => calls++);

    store.clear();

    expect(store.count).toBe(0);
    expect(calls).toBe(1);
  });

  describe('importShapes', () => {
    it('reconstructs FreeformShape instances from raw JSON and notifies once', () => {
      const store = new ShapeLibraryStore();
      const raw = [makeShape('s1').toJSON(), makeShape('s2').toJSON()];
      let calls = 0;
      store.onChange(() => calls++);

      store.importShapes(raw, FreeformShape);

      expect(store.count).toBe(2);
      expect(store.shapes.every((s) => s instanceof FreeformShape)).toBe(true);
      expect(calls).toBe(1);
    });

    it('skips malformed entries missing required fields', () => {
      const store = new ShapeLibraryStore();
      store.importShapes([{ notAShape: true }], FreeformShape);
      expect(store.count).toBe(0);
    });
  });
});
