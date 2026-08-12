/**
 * Pure 2D <-> 3D coordinate mapping for the 3D visualizer.
 *
 * The board sits flat on the 3D XZ plane, so Three.js/OrbitControls/
 * lighting's Y-up defaults work unmodified (no fighting the library) and a
 * straight-down orthographic camera over it is the standard CAD/editor
 * "plan view" setup - the natural fit for Drawing Mode's "match the 2D
 * layout exactly" requirement:
 *
 *   2D X       -> 3D X
 *   2D Y       -> 3D Z
 *   height     -> 3D Y (up) - nail height / a curve's Z-layer height
 *
 * Kept free of any `three` import on purpose, exactly like `Point.js` is kept
 * free of p5 - so this stays trivially unit-testable without a WebGL/DOM
 * environment.
 */

/**
 * @param {{x:number, y:number}} point2 a 2D design-space point (nail or curve X/Y)
 * @param {number} [height] world Y (up) - nail height or a curve's Z-layer height
 * @returns {{x:number, y:number, z:number}}
 */
export function to3D(point2, height = 0) {
  return { x: point2.x, y: height, z: point2.y };
}

/**
 * Inverse of `to3D` - drops the 3D Y (height) entirely, recovering the 2D
 * design-space point a 3D world position projects onto. Used by Drawing
 * Mode's board-plane raycast hit to feed straight back into the existing 2D
 * nail-snapping/curve-building logic (`DeformableGrid#findNearestPoint`,
 * `SelectionStore`, ...) unmodified.
 * @param {{x:number, y:number, z:number}} point3
 * @returns {{x:number, y:number}}
 */
export function fromWorld3(point3) {
  return { x: point3.x, y: point3.z };
}
