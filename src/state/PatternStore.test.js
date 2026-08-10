import { describe, it, expect } from 'vitest';
import { PatternStore } from './PatternStore.js';
import { Pattern } from '../models/Pattern.js';

function makePattern(id) {
  return new Pattern({ id, name: id, points: [{ x: 0, y: 0 }], colors: [] });
}

describe('PatternStore', () => {
  it('add/findById', () => {
    const store = new PatternStore();
    const p = makePattern('a');
    store.add(p);
    expect(store.findById('a')).toBe(p);
    expect(store.findById('missing')).toBeNull();
  });

  it('select/clearSelection track the active pattern and in-use flag', () => {
    const store = new PatternStore();
    store.add(makePattern('a'));

    store.select('a', true);
    expect(store.selectedPatternId).toBe('a');
    expect(store.isInUse).toBe(true);
    expect(store.selectedPattern.id).toBe('a');

    store.clearSelection();
    expect(store.selectedPatternId).toBeNull();
    expect(store.isInUse).toBe(false);
  });

  it('togglePlacementMode alternates manual/auto, starting manual', () => {
    const store = new PatternStore();
    expect(store.placementMode).toBe('manual');
    expect(store.togglePlacementMode()).toBe('auto');
    expect(store.togglePlacementMode()).toBe('manual');
  });

  it('preview can be set and cleared independently of selection', () => {
    const store = new PatternStore();
    const p = makePattern('a');
    store.setPreview(p, { x: 1, y: 2 });
    expect(store.preview).toEqual({ pattern: p, mousePosition: { x: 1, y: 2 } });
    store.clearPreview();
    expect(store.preview).toBeNull();
  });

  it('importPatterns skips malformed entries', () => {
    const store = new PatternStore();
    store.importPatterns(
      [
        { id: '1', name: 'ok', points: [{ x: 0, y: 0 }], colors: [] },
        { id: '2', points: [{ x: 0, y: 0 }] }, // missing name
        { name: 'no-id', points: [{ x: 0, y: 0 }] },
      ],
      Pattern
    );
    expect(store.patterns).toHaveLength(1);
    expect(store.patterns[0].id).toBe('1');
  });
});
