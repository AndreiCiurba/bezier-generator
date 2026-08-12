import { describe, it, expect } from 'vitest';
import { SelectionStore } from './SelectionStore.js';

describe('SelectionStore', () => {
  it('starts empty', () => {
    const s = new SelectionStore();
    expect(s.count).toBe(0);
    expect(s.points).toEqual([]);
    expect(s.lastPoint).toBeNull();
  });

  it('add appends, count and lastPoint track it', () => {
    const s = new SelectionStore();
    s.add({ x: 1, y: 1 });
    s.add({ x: 2, y: 2 });
    expect(s.count).toBe(2);
    expect(s.lastPoint).toEqual({ x: 2, y: 2 });
  });

  it('isReadyForCurve requires at least 3 points', () => {
    const s = new SelectionStore();
    s.add({ x: 0, y: 0 });
    s.add({ x: 1, y: 1 });
    expect(s.isReadyForCurve()).toBe(false);
    s.add({ x: 2, y: 2 });
    expect(s.isReadyForCurve()).toBe(true);
  });

  it('reset clears points and lastPoint', () => {
    const s = new SelectionStore();
    s.add({ x: 0, y: 0 });
    s.reset();
    expect(s.count).toBe(0);
    expect(s.lastPoint).toBeNull();
  });

  describe('undoLast', () => {
    it('removes only the most recently added point', () => {
      const s = new SelectionStore();
      s.add({ x: 0, y: 0 });
      s.add({ x: 1, y: 1 });
      s.add({ x: 2, y: 2 });

      const removed = s.undoLast();

      expect(removed).toEqual({ x: 2, y: 2 });
      expect(s.count).toBe(2);
      expect(s.lastPoint).toEqual({ x: 1, y: 1 });
    });

    it('is a no-op on an empty selection', () => {
      const s = new SelectionStore();
      expect(s.undoLast()).toBeUndefined();
      expect(s.count).toBe(0);
    });

    it('can be called repeatedly down to empty', () => {
      const s = new SelectionStore();
      s.add({ x: 0, y: 0 });
      s.add({ x: 1, y: 1 });
      s.undoLast();
      s.undoLast();
      expect(s.count).toBe(0);
      expect(s.lastPoint).toBeNull();
    });
  });
});
