/**
 * Pure math for the 3D visualizer's "useful default" camera framing - no
 * three.js dependency, so it's directly unit-testable (same "kept
 * independent of the rendering lib" rationale as `axisMapping.js`). Used
 * both for the initial camera position and for the "Reset Camera" control,
 * so both always agree, and both automatically re-fit whatever the board's
 * current footprint actually is (it changes with the Grid Size control).
 */

// A fixed elevated three-quarter direction (from the orbit target, the board
// center) for the default viewpoint - reads immediately as "a physical board
// viewed obliquely" rather than a flat top-down or dead-on side view.
const RAW_VIEW_DIRECTION = { x: 0.5, y: 0.6, z: 0.9 };

function normalize(v) {
  const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

export const DEFAULT_VIEW_DIRECTION = normalize(RAW_VIEW_DIRECTION);

/**
 * The camera distance (from the orbit target) needed to fit a
 * `boardWidth` x `boardDepth` rectangle's diagonal within a perspective
 * camera's vertical field of view, plus a comfortable padding margin.
 * @param {number} boardWidth
 * @param {number} boardDepth
 * @param {number} fovDegrees vertical field of view
 * @param {number} [padding] multiplier, >1 leaves breathing room around the board
 * @returns {number}
 */
export function framingDistance(boardWidth, boardDepth, fovDegrees, padding = 1.3) {
  const radius = Math.sqrt(boardWidth * boardWidth + boardDepth * boardDepth) / 2;
  const fovRadians = (fovDegrees * Math.PI) / 180;
  return (radius / Math.sin(fovRadians / 2)) * padding;
}

/**
 * A "useful default" camera position (world Y up, board flat on XZ - see
 * `axisMapping.js`) that frames the whole board obliquely, scaled to
 * whatever the board's current footprint actually is.
 * @param {number} boardWidth
 * @param {number} boardDepth
 * @param {number} fovDegrees
 * @returns {{x:number, y:number, z:number}}
 */
export function defaultCameraPosition(boardWidth, boardDepth, fovDegrees) {
  const distance = framingDistance(boardWidth, boardDepth, fovDegrees);
  return {
    x: DEFAULT_VIEW_DIRECTION.x * distance,
    y: DEFAULT_VIEW_DIRECTION.y * distance,
    z: DEFAULT_VIEW_DIRECTION.z * distance,
  };
}

/**
 * The half-width/half-height an orthographic camera's frustum needs to
 * contain the whole `boardWidth` x `boardDepth` board (plus padding),
 * letterboxed/pillarboxed to the actual `viewportWidth`/`viewportHeight`
 * aspect ratio so nothing is stretched or cropped - Drawing Mode's top-down
 * camera (`DrawingModeCamera.js`) applies this directly to its
 * `left`/`right`/`top`/`bottom` frustum planes. Pure "contain" fit, kept
 * free of any `three` import so it's directly unit-testable.
 * @param {number} boardWidth
 * @param {number} boardDepth
 * @param {number} viewportWidth
 * @param {number} viewportHeight
 * @param {number} [padding] multiplier, >1 leaves breathing room around the board
 * @returns {{halfWidth: number, halfHeight: number}}
 */
export function orthographicHalfExtents(boardWidth, boardDepth, viewportWidth, viewportHeight, padding = 1.1) {
  const boardHalfWidth = (boardWidth / 2) * padding;
  const boardHalfDepth = (boardDepth / 2) * padding;
  const viewportAspect = viewportWidth / viewportHeight;
  const boardAspect = boardHalfWidth / boardHalfDepth;

  if (viewportAspect > boardAspect) {
    // Viewport proportionally wider than the board - fit by height.
    const halfHeight = boardHalfDepth;
    return { halfWidth: halfHeight * viewportAspect, halfHeight };
  }
  const halfWidth = boardHalfWidth;
  return { halfWidth, halfHeight: halfWidth / viewportAspect };
}
