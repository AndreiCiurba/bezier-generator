import { describe, it, expect } from 'vitest';
import { WeaveState } from './WeaveState.js';
import { WeaveRecipe } from '../models/WeaveRecipe.js';

function makeRecipe(id) {
  return new WeaveRecipe({ id, name: id, sides: 6, n: 13, leap: 5 });
}

describe('WeaveState', () => {
  it('defaults to manual placement mode and an empty live selection', () => {
    const state = new WeaveState();
    expect(state.placementMode).toBe('manual');
    expect(state.liveSelection.size).toBe(0);
  });

  it('setN/setLeap update the value and notify listeners', () => {
    const state = new WeaveState(8, 3);
    let calls = 0;
    state.onChange(() => calls++);

    state.setN(12);
    state.setLeap(5);

    expect(state.n).toBe(12);
    expect(state.leap).toBe(5);
    expect(calls).toBe(2);
  });

  it('togglePlacementMode flips manual/auto and returns the new mode', () => {
    const state = new WeaveState();
    expect(state.togglePlacementMode()).toBe('auto');
    expect(state.placementMode).toBe('auto');
    expect(state.togglePlacementMode()).toBe('manual');
  });

  describe('toggleLive', () => {
    it('adds an id not yet in the selection', () => {
      const state = new WeaveState();
      state.toggleLive('cell-1');
      expect(state.isLive('cell-1')).toBe(true);
    });

    it('removes an id already in the selection, without touching other ids', () => {
      const state = new WeaveState();
      state.toggleLive('cell-1');
      state.toggleLive('cell-2');
      state.toggleLive('cell-1');
      expect(state.isLive('cell-1')).toBe(false);
      expect(state.isLive('cell-2')).toBe(true);
    });
  });

  describe('selectOnly', () => {
    it('replaces the whole selection with just the given id', () => {
      const state = new WeaveState();
      state.toggleLive('cell-1');
      state.toggleLive('cell-2');
      state.selectOnly('cell-3');
      expect(state.isLive('cell-1')).toBe(false);
      expect(state.isLive('cell-2')).toBe(false);
      expect(state.isLive('cell-3')).toBe(true);
      expect(state.liveSelection.size).toBe(1);
    });
  });

  describe('selectOnlyMany', () => {
    it('replaces the whole selection with exactly the given ids', () => {
      const state = new WeaveState();
      state.toggleLive('stale');
      state.selectOnlyMany(['cell-1', 'cell-2', 'cell-3']);
      expect(state.isLive('stale')).toBe(false);
      expect(state.isLive('cell-1')).toBe(true);
      expect(state.isLive('cell-2')).toBe(true);
      expect(state.isLive('cell-3')).toBe(true);
      expect(state.liveSelection.size).toBe(3);
    });

    it('selectOnly is equivalent to selectOnlyMany with a single id', () => {
      const state = new WeaveState();
      state.selectOnlyMany(['a', 'b']);
      state.selectOnly('c');
      expect(state.liveSelection).toEqual(new Set(['c']));
    });
  });

  describe('neighborRadius', () => {
    it('defaults to 0', () => {
      expect(new WeaveState().neighborRadius).toBe(0);
    });

    it('setNeighborRadius updates the value and notifies listeners', () => {
      const state = new WeaveState();
      let calls = 0;
      state.onChange(() => calls++);
      state.setNeighborRadius(2);
      expect(state.neighborRadius).toBe(2);
      expect(calls).toBe(1);
    });

    it('clamps negative values to 0', () => {
      const state = new WeaveState();
      state.setNeighborRadius(-3);
      expect(state.neighborRadius).toBe(0);
    });
  });

  describe('reset', () => {
    it('clears the entire live selection', () => {
      const state = new WeaveState();
      state.toggleLive('cell-1');
      state.toggleLive('cell-2');
      state.reset();
      expect(state.liveSelection.size).toBe(0);
    });
  });

  describe('recipes', () => {
    it('addRecipe/findRecipeById', () => {
      const state = new WeaveState();
      const r = makeRecipe('a');
      state.addRecipe(r);
      expect(state.findRecipeById('a')).toBe(r);
      expect(state.findRecipeById('missing')).toBeNull();
    });

    it('addRecipe notifies listeners', () => {
      const state = new WeaveState();
      let calls = 0;
      state.onChange(() => calls++);
      state.addRecipe(makeRecipe('a'));
      expect(calls).toBe(1);
    });

    it('importRecipes skips malformed entries', () => {
      const state = new WeaveState();
      state.importRecipes(
        [
          { id: '1', name: 'ok', sides: 3, n: 8, leap: 2 },
          { id: '2', name: 'missing sides', n: 8, leap: 2 },
          { name: 'no-id', sides: 3, n: 8, leap: 2 },
        ],
        WeaveRecipe
      );
      expect(state.recipes).toHaveLength(1);
      expect(state.recipes[0].id).toBe('1');
    });
  });

  describe('onChange', () => {
    it('the returned unsubscribe function stops further notifications', () => {
      const state = new WeaveState();
      let calls = 0;
      const unsubscribe = state.onChange(() => calls++);
      state.setN(9);
      unsubscribe();
      state.setN(10);
      expect(calls).toBe(1);
    });
  });
});
