import { resampleClosedOutline } from '../core/bezierOutline.js';

/**
 * A saved, fully-configured Shape Designer shape: a closed bezier outline
 * (`anchors`, in the shape's own local space - see `bezierOutline.js`'s own
 * doc for the anchor shape) plus everything the leap-weave engine needs to
 * weave it - its own nail count, leap, color layers, and optional height/
 * stroke-weight overrides. Deliberately has no dependency on ID generation
 * (same reasoning as `Pattern.js`) - callers pass in an `id` (see `utils/id.js`).
 *
 * `nailCount`/`leap`/`colors` feed straight into the *existing*
 * `closedWeaveMath.js#closedWeaveSegmentsForCurve(cellCorners, 0, leap,
 * colors)` once `resampledOutline()` turns the smooth bezier loop into
 * exactly `nailCount` evenly arc-length-spaced nail points - no new weave
 * math anywhere in this class, just the data a shape needs to carry plus a
 * thin pass-through to that resampling.
 */
export class FreeformShape {
  /**
   * @param {{
   *   id: string, name: string,
   *   anchors: import('../core/bezierOutline.js').Anchor[],
   *   nailCount: number, leap: number,
   *   colors: {color:string, enabled:boolean}[],
   *   height?: number|null, weight?: number|null,
   *   weaveRule?: 'legacy'|'center',
   * }} config `height`/`weight` are `null` (the default) when this shape
   *   should use the Arrange board's global height/stroke-weight instead of
   *   its own override - same convention for both.
   */
  constructor({ id, name, anchors, nailCount, leap, colors, height = null, weight = null, weaveRule = 'legacy' }) {
    this.id = id;
    // Which step rule `leap` means (see `closedWeaveMath.js#closedWeaveStep`).
    // Shapes saved before the center-out rule existed have no such field and
    // keep drawing exactly as they did ('legacy'); new Shape Designer shapes pass 'center'.
    this.weaveRule = weaveRule === 'center' ? 'center' : 'legacy';
    this.name = name;
    this.anchors = anchors.map((a) => ({
      x: a.x,
      y: a.y,
      handleIn: a.handleIn ? { x: a.handleIn.x, y: a.handleIn.y } : null,
      handleOut: a.handleOut ? { x: a.handleOut.x, y: a.handleOut.y } : null,
    }));
    this.nailCount = nailCount;
    this.leap = leap;
    // Deep-copied, same reasoning as `anchors` above and `StrokePalette#snapshot` -
    // placing an instance (`ArrangedShapeStore#add`, via `FreeformShape.fromJSON`)
    // must never leave it aliasing the library shape's own color array, or a
    // future edit to one would silently reach into the other.
    this.colors = colors.map((c) => ({ color: c.color, enabled: c.enabled }));
    this.height = height;
    this.weight = weight;
  }

  /**
   * This shape's own nails - exactly `nailCount` points, evenly spaced by arc
   * length around its closed bezier outline. See `bezierOutline.js#resampleClosedOutline`.
   * @returns {{x:number,y:number}[]}
   */
  resampledOutline() {
    return resampleClosedOutline(this.anchors, this.nailCount);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      anchors: this.anchors,
      nailCount: this.nailCount,
      leap: this.leap,
      colors: this.colors,
      height: this.height,
      weight: this.weight,
      weaveRule: this.weaveRule,
    };
  }

  /**
   * Reconstructs a `FreeformShape` from its own `toJSON()` shape (e.g. after
   * reading an imported library/arrangement JSON file) - mirrors how
   * `PatternStore#importPatterns`/`WeaveState#importRecipes` reconstruct
   * their own saved models from raw parsed JSON.
   * @param {ReturnType<FreeformShape['toJSON']>} raw
   * @returns {FreeformShape}
   */
  static fromJSON(raw) {
    return new FreeformShape({
      id: raw.id,
      name: raw.name,
      anchors: raw.anchors,
      nailCount: raw.nailCount,
      leap: raw.leap,
      colors: raw.colors,
      height: raw.height ?? null,
      weight: raw.weight ?? null,
      weaveRule: raw.weaveRule,
    });
  }
}
