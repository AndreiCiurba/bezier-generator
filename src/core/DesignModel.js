/**
 * The shared "design model" boundary (3d_string_art_visualizer_epic.md's own
 * term): a thin, p5/Three.js-free read-through over a deformable nail grid and
 * a curve store, assembling exactly the pieces a renderer needs - stable nail
 * ids/positions, and ordered, colored, visibility-filtered curves - without
 * either renderer maintaining its own independent copy of the design (both
 * the existing p5 2D page and the Three.js 3D page consume the same instance
 * shape).
 *
 * Structurally parallel to how `DeformableGrid` itself wraps a plain `Grid`:
 * this never mutates either input, it only reads.
 *
 * Curve *height* in the 3D renderer is derived per-color-layer from a
 * curve's own `colors.length` (see `core/curveZLayers.js`), not from a
 * curve's position among other curves - so this model doesn't assign or
 * expose any curve-ordering-based Z/layer slot; the 2D and 3D renderers each
 * derive height/paint-order from what they already have (store order for 2D
 * paint order, `colors.length` for 3D height).
 */
export class DesignModel {
  /**
   * @param {import('./DeformableGrid.js').DeformableGrid} deformation
   * @param {import('../state/CurveStore.js').CurveStore} curveStore
   */
  constructor(deformation, curveStore) {
    this.deformation = deformation;
    this.curveStore = curveStore;
  }

  /**
   * Every nail, current (possibly deformed) position included. `id` is the
   * nail's array index into `deformation.points` - stable across deformation
   * (deformation moves positions, never reorders/adds/removes nails), so it
   * doubles as a persistent nail identity with no new id scheme needed.
   * @returns {{id: number, position: import('./Point.js').Point}[]}
   */
  get nails() {
    return this.deformation.points.map((position, id) => ({ id, position }));
  }

  /**
   * Every committed curve, in store (paint) order, each tagged with its id/
   * visibility.
   * @returns {{curve: import('../models/Curve.js').Curve, id: string, visible: boolean}[]}
   */
  get curves() {
    return this.curveStore.curves.map((curve) => ({ curve, id: curve.id, visible: curve.visible }));
  }

  /** Same shape as `.curves`, filtered to only the currently-visible ones. */
  get visibleCurves() {
    return this.curves.filter((entry) => entry.visible);
  }
}
