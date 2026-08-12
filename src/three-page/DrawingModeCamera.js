import * as THREE from 'three';
import { BOARD_TOP_Y } from './SceneSync.js';
import { orthographicHalfExtents } from './cameraFraming.js';

// Arbitrary height directly above the board - only the direction/framing
// matters for an orthographic camera, not the exact distance.
const CAMERA_HEIGHT = 2000;
const CAMERA_NEAR = 1;
const CAMERA_FAR = 10000;

/**
 * The dedicated top-down orthographic camera for Drawing Mode, plus the
 * raycasting-to-board-plane math its click handling needs.
 *
 * Positioned directly above the board, looking straight down (-Y), with
 * `up = (0, 0, -1)`. That specific up vector is what makes the rendered view
 * match the *existing 2D layout* exactly rather than a mirrored/rotated one:
 * with `axisMapping`'s plain (no-flip) 2D-X->3D-X / 2D-Y->3D-Z remap, the
 * resulting camera basis works out to local +X = world +X (screen-right =
 * 2D-right) and local +Y = world -Z (screen-up = 2D-up, since 2D Y increases
 * *downward*) - i.e. no mirroring, verified via the standard lookAt basis
 * derivation, not just assumed.
 */
export class DrawingModeCamera {
  constructor() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, CAMERA_NEAR, CAMERA_FAR);
    this.camera.up.set(0, 0, -1);
    this.camera.position.set(0, CAMERA_HEIGHT, 0);
    this.camera.lookAt(0, 0, 0);

    this._raycaster = new THREE.Raycaster();
    // The board's top surface / nail-base plane (world Y = BOARD_TOP_Y) -
    // exactly where 2D design-space points conceptually live.
    this._boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BOARD_TOP_Y);
    this._hitPoint = new THREE.Vector3();
    this._ndc = new THREE.Vector2();
  }

  /**
   * Fits the camera's orthographic frustum to contain the whole
   * `boardWidth` x `boardDepth` board (plus padding), letterboxed/
   * pillarboxed to the actual viewport aspect ratio so nothing is distorted
   * or cropped - called on every resize and every board-size (Grid Size)
   * change, so it's always ready the moment Drawing Mode is entered.
   */
  updateFrustum(boardWidth, boardDepth, viewportWidth, viewportHeight) {
    const { halfWidth, halfHeight } = orthographicHalfExtents(boardWidth, boardDepth, viewportWidth, viewportHeight);
    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Raycasts a normalized-device-coordinate mouse position through this
   * camera onto the board plane.
   * @param {number} ndcX in [-1, 1]
   * @param {number} ndcY in [-1, 1]
   * @returns {{x:number, y:number, z:number} | null} the world-space hit, or null if the ray is parallel to the plane (shouldn't happen for this top-down camera, but the camera could theoretically be misconfigured)
   */
  raycastToBoardPlane(ndcX, ndcY) {
    this._ndc.set(ndcX, ndcY);
    this._raycaster.setFromCamera(this._ndc, this.camera);
    const hit = this._raycaster.ray.intersectPlane(this._boardPlane, this._hitPoint);
    return hit ? { x: hit.x, y: hit.y, z: hit.z } : null;
  }
}
