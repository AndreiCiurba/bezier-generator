import { MIN_CLOSED_ANCHORS } from '../core/bezierOutline.js';

/**
 * The Shape Designer's in-progress shape (before it's committed into a
 * `FreeformShape` and pushed to `ShapeLibraryStore`) - the anchor-based
 * equivalent of `SelectionStore`'s in-progress point list. Holds the live,
 * mutable anchor array (see `core/bezierOutline.js`'s own doc for the anchor
 * shape) plus which anchor (if any) is currently selected, for showing/
 * dragging its handles.
 *
 * `onChange` notifies on every mutation - needed because the settings panel
 * (nail count/leap/color inputs) and the canvas live preview both need to
 * react to edits made from the other, the same reasoning `WeaveState` already
 * documents for itself.
 */
export class ShapeEditorState {
  #anchors = [];
  #closed = false;
  #selectedIndex = null;
  #listeners = new Set();

  /** Live reference - read-only by convention, mutate only via this class's own methods. */
  get anchors() {
    return this.#anchors;
  }

  get closed() {
    return this.#closed;
  }

  get selectedIndex() {
    return this.#selectedIndex;
  }

  get selectedAnchor() {
    return this.#selectedIndex === null ? null : this.#anchors[this.#selectedIndex];
  }

  /** Whether there are enough anchors to close the loop (see `bezierOutline.js#MIN_CLOSED_ANCHORS`). */
  canClose() {
    return this.#anchors.length >= MIN_CLOSED_ANCHORS;
  }

  /** Appends a new anchor with no explicit handles (so `autoHandles` smooths it in). No-op once the loop is closed. */
  addAnchor(point) {
    if (this.#closed) return;
    this.#anchors.push({ x: point.x, y: point.y, handleIn: null, handleOut: null });
    this.#notify();
  }

  /** Removes just the most recently added anchor - one step back, mirrors `SelectionStore#undoLast`. No-op once closed or empty. */
  undoLastAnchor() {
    if (this.#closed || this.#anchors.length === 0) return;
    this.#anchors.pop();
    this.#notify();
  }

  /** Closes the loop. No-op (returns false) below `MIN_CLOSED_ANCHORS` anchors. */
  close() {
    if (!this.canClose()) return false;
    this.#closed = true;
    this.#notify();
    return true;
  }

  /**
   * Replaces the whole in-progress shape with a preset's anchor ring (deep
   * copy, so later drags never alias the preset generator's own objects) -
   * presets are already-closed shapes, ready to reshape immediately.
   * @param {import('../core/bezierOutline.js').Anchor[]} presetAnchors
   */
  loadPreset(presetAnchors) {
    this.#anchors = presetAnchors.map((a) => ({
      x: a.x,
      y: a.y,
      handleIn: a.handleIn ? { x: a.handleIn.x, y: a.handleIn.y } : null,
      handleOut: a.handleOut ? { x: a.handleOut.x, y: a.handleOut.y } : null,
    }));
    this.#closed = true;
    this.#selectedIndex = null;
    this.#notify();
  }

  selectAnchor(index) {
    this.#selectedIndex = index;
    this.#notify();
  }

  clearSelectedAnchor() {
    this.#selectedIndex = null;
    this.#notify();
  }

  /** Rigidly moves anchor `index` to `point`, carrying its handles along by the same delta so its curvature shape doesn't change. */
  moveAnchor(index, point) {
    const anchor = this.#anchors[index];
    if (!anchor) return;
    const dx = point.x - anchor.x;
    const dy = point.y - anchor.y;
    anchor.x = point.x;
    anchor.y = point.y;
    if (anchor.handleIn) {
      anchor.handleIn = { x: anchor.handleIn.x + dx, y: anchor.handleIn.y + dy };
    }
    if (anchor.handleOut) {
      anchor.handleOut = { x: anchor.handleOut.x + dx, y: anchor.handleOut.y + dy };
    }
    this.#notify();
  }

  /**
   * Sets one handle of anchor `index` to an absolute position - adjusting
   * curvature directly. `which` is `'handleIn'` or `'handleOut'`; the other
   * handle is left untouched (no symmetric mirroring).
   * @param {number} index @param {'handleIn'|'handleOut'} which @param {{x:number,y:number}} point
   */
  moveHandle(index, which, point) {
    const anchor = this.#anchors[index];
    if (!anchor) return;
    anchor[which] = { x: point.x, y: point.y };
    this.#notify();
  }

  /** Collapses one handle onto its own anchor's position - degenerates that side of the curve to a straight line (see `bezierOutline.js`'s own doc). */
  straightenHandle(index, which) {
    const anchor = this.#anchors[index];
    if (!anchor) return;
    anchor[which] = { x: anchor.x, y: anchor.y };
    this.#notify();
  }

  /** Clears the in-progress shape entirely, ready for the next one. */
  reset() {
    this.#anchors = [];
    this.#closed = false;
    this.#selectedIndex = null;
    this.#notify();
  }

  /**
   * Subscribes to any mutation. Returns an unsubscribe function - same shape
   * as `CurveStore#onChange`/`StrokePalette#onChange`.
   * @param {() => void} listener
   * @returns {() => void}
   */
  onChange(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #notify() {
    for (const listener of this.#listeners) listener();
  }
}
