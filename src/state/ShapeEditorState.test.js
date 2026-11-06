import { describe, it, expect } from 'vitest';
import { ShapeEditorState } from './ShapeEditorState.js';
import { triangleAnchors } from '../core/shapePresets.js';

describe('ShapeEditorState', () => {
  it('starts empty and open (not yet closed)', () => {
    const state = new ShapeEditorState();
    expect(state.anchors).toEqual([]);
    expect(state.closed).toBe(false);
  });

  it('addAnchor appends an anchor with no explicit handles, and notifies listeners', () => {
    const state = new ShapeEditorState();
    let calls = 0;
    state.onChange(() => calls++);

    state.addAnchor({ x: 10, y: 20 });

    expect(state.anchors).toEqual([{ x: 10, y: 20, handleIn: null, handleOut: null }]);
    expect(calls).toBe(1);
  });

  it('addAnchor is a no-op once the loop is closed', () => {
    const state = new ShapeEditorState();
    state.addAnchor({ x: 0, y: 0 });
    state.addAnchor({ x: 10, y: 0 });
    state.addAnchor({ x: 5, y: 10 });
    state.close();

    state.addAnchor({ x: 100, y: 100 });
    expect(state.anchors).toHaveLength(3);
  });

  it('undoLastAnchor removes just the most recently added anchor', () => {
    const state = new ShapeEditorState();
    state.addAnchor({ x: 0, y: 0 });
    state.addAnchor({ x: 10, y: 0 });
    state.undoLastAnchor();
    expect(state.anchors).toEqual([{ x: 0, y: 0, handleIn: null, handleOut: null }]);
  });

  describe('canClose / close', () => {
    it('cannot close below 3 anchors', () => {
      const state = new ShapeEditorState();
      state.addAnchor({ x: 0, y: 0 });
      state.addAnchor({ x: 10, y: 0 });
      expect(state.canClose()).toBe(false);
      expect(state.close()).toBe(false);
      expect(state.closed).toBe(false);
    });

    it('closes once 3 or more anchors exist', () => {
      const state = new ShapeEditorState();
      state.addAnchor({ x: 0, y: 0 });
      state.addAnchor({ x: 10, y: 0 });
      state.addAnchor({ x: 5, y: 10 });
      expect(state.close()).toBe(true);
      expect(state.closed).toBe(true);
    });
  });

  it('loadPreset replaces the anchors with a deep copy and closes the loop', () => {
    const state = new ShapeEditorState();
    const preset = triangleAnchors({ x: 0, y: 0 }, 10);

    state.loadPreset(preset);

    expect(state.closed).toBe(true);
    expect(state.anchors).toEqual(preset);
    preset[0].x = 999;
    expect(state.anchors[0].x).not.toBe(999);
  });

  describe('hydrate', () => {
    it('restores anchors and an explicit open (not-yet-closed) state', () => {
      const state = new ShapeEditorState();
      const saved = [
        { x: 0, y: 0, handleIn: null, handleOut: null },
        { x: 10, y: 0, handleIn: null, handleOut: null },
      ];

      state.hydrate({ anchors: saved, closed: false });

      expect(state.closed).toBe(false);
      expect(state.anchors).toEqual(saved);
    });

    it('restores a closed state and deep-copies the anchors', () => {
      const state = new ShapeEditorState();
      const saved = triangleAnchors({ x: 0, y: 0 }, 10);

      state.hydrate({ anchors: saved, closed: true });

      expect(state.closed).toBe(true);
      saved[0].x = 999;
      expect(state.anchors[0].x).not.toBe(999);
    });
  });

  describe('moveAnchor', () => {
    it('moves the anchor and carries its handles along by the same delta', () => {
      const state = new ShapeEditorState();
      state.loadPreset([
        { x: 0, y: 0, handleIn: { x: -2, y: 0 }, handleOut: { x: 2, y: 0 } },
        { x: 10, y: 0, handleIn: null, handleOut: null },
        { x: 5, y: 10, handleIn: null, handleOut: null },
      ]);

      state.moveAnchor(0, { x: 5, y: 5 });

      expect(state.anchors[0]).toEqual({ x: 5, y: 5, handleIn: { x: 3, y: 5 }, handleOut: { x: 7, y: 5 } });
    });

    it('leaves null handles null after a move', () => {
      const state = new ShapeEditorState();
      state.addAnchor({ x: 0, y: 0 });
      state.moveAnchor(0, { x: 5, y: 5 });
      expect(state.anchors[0]).toEqual({ x: 5, y: 5, handleIn: null, handleOut: null });
    });
  });

  it('moveHandle sets just the given handle to an absolute position', () => {
    const state = new ShapeEditorState();
    state.addAnchor({ x: 0, y: 0 });
    state.moveHandle(0, 'handleOut', { x: 3, y: 4 });
    expect(state.anchors[0].handleOut).toEqual({ x: 3, y: 4 });
    expect(state.anchors[0].handleIn).toBeNull();
  });

  it('straightenHandle collapses a handle onto its own anchor position', () => {
    const state = new ShapeEditorState();
    state.addAnchor({ x: 7, y: 8 });
    state.moveHandle(0, 'handleOut', { x: 3, y: 4 });
    state.straightenHandle(0, 'handleOut');
    expect(state.anchors[0].handleOut).toEqual({ x: 7, y: 8 });
  });

  it('reset clears the anchors, closed flag, and selection', () => {
    const state = new ShapeEditorState();
    state.loadPreset(triangleAnchors({ x: 0, y: 0 }, 10));
    state.selectAnchor(1);

    state.reset();

    expect(state.anchors).toEqual([]);
    expect(state.closed).toBe(false);
    expect(state.selectedIndex).toBeNull();
  });

  describe('selection', () => {
    it('selectAnchor/selectedAnchor track the currently selected anchor', () => {
      const state = new ShapeEditorState();
      state.loadPreset(triangleAnchors({ x: 0, y: 0 }, 10));
      state.selectAnchor(1);
      expect(state.selectedIndex).toBe(1);
      expect(state.selectedAnchor).toBe(state.anchors[1]);
    });

    it('clearSelectedAnchor clears it back to null', () => {
      const state = new ShapeEditorState();
      state.loadPreset(triangleAnchors({ x: 0, y: 0 }, 10));
      state.selectAnchor(1);
      state.clearSelectedAnchor();
      expect(state.selectedIndex).toBeNull();
      expect(state.selectedAnchor).toBeNull();
    });
  });
});
