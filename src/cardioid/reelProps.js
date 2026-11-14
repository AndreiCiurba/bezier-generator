import * as THREE from 'three';
import { CardioidSceneSync } from './CardioidSceneSync.js';
import { BOARD_TOP_Y, DEFAULT_BOARD_THICKNESS } from '../three-page/SceneSync.js';
import { hammerRaise } from './cardioidReelFrame.js';

/**
 * The props of a making-of reel (a recipe with a `making` section): the coat
 * of paint going onto the bare board, the spray can laying it down, and the
 * hammer driving the nails.
 * Reel-only - nothing here is ever built on the normal Cardioid page.
 *
 * Everything is modelled from primitives and sized against the circle
 * radius, treating the board as roughly 50 cm across, so a hammer is a
 * believable hammer next to it.
 *
 * The board itself is drawn here too while these props are in use (the reel
 * tells `CardioidSceneSync` to leave its own out): a bare one and a painted
 * one in the same place, each cut off at the edge the spray can has reached,
 * so there is never a painted surface lying on top of an unpainted one.
 *
 * `update()` places every prop for one frame from that frame's resolved
 * numbers alone, so (like the rest of the reel timeline) a frame looks the
 * same whenever and in whatever order it is rendered.
 */

const SPRAY_PASSES = 3; // side-to-side sweeps of the can over the whole board
const HAMMER_SWING_DEGREES = 20;
const HAMMER_HITS_PER_NAIL = 3;
// The handle comes in at this angle to the line from the board's center out
// through the nail, so a camera looking in at that nail sees the hammer side-on.
const HAMMER_APPROACH_DEGREES = 62;

/** Handle along local +X from the grip (the origin), head at the far end with its striking face downward. */
function buildHammer(u) {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#b98a52', roughness: 0.7 });
  const steel = new THREE.MeshStandardMaterial({ color: '#b9bec6', roughness: 0.35, metalness: 0.6 });
  const handleLength = 2600 * u;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(85 * u, 105 * u, handleLength, 16), wood);
  handle.rotation.z = Math.PI / 2;
  handle.position.x = handleLength / 2;
  const head = new THREE.Mesh(new THREE.CylinderGeometry(190 * u, 190 * u, 900 * u, 20), steel);
  head.position.set(handleLength, 0, 0);
  group.add(handle, head);
  group.userData = { handleLength, headHalfHeight: 450 * u };
  return group;
}

/** Stands along local +Y with its base at the origin; the mist cone hangs below the nozzle end. */
function buildSprayCan(u, canColor) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(330 * u, 330 * u, 1700 * u, 24), new THREE.MeshStandardMaterial({ color: canColor, roughness: 0.35, metalness: 0.3 }));
  body.position.y = 850 * u;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(150 * u, 250 * u, 260 * u, 20), new THREE.MeshStandardMaterial({ color: '#22242a', roughness: 0.5 }));
  cap.position.y = 1830 * u;
  const mist = new THREE.Mesh(
    new THREE.ConeGeometry(1100 * u, 2300 * u, 28, 1, true),
    new THREE.MeshBasicMaterial({ color: '#aab0bd', transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
  );
  mist.position.y = 1960 * u + 1150 * u; // cone tip at the nozzle, opening away from the can
  mist.rotation.x = Math.PI;
  group.add(body, cap, mist);
  return group;
}

export class MakingProps {
  /**
   * @param {import('three').Scene} scene
   * @param {{radius:number, bareColor:string, paintColor:string, canColor:string}} options
   *   `radius` is the circle radius the props are sized against
   */
  constructor(scene, { radius, bareColor, paintColor, canColor }) {
    this.scene = scene;
    this.unit = (radius / 3000) * 1.5;
    this.boardSize = CardioidSceneSync.boardSizeFor(radius);

    // Bare board on the far side of the wet edge, painted board on the near
    // side (both need `renderer.localClippingEnabled`).
    this.bareEdge = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    this.paintEdge = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
    const boardGeometry = new THREE.BoxGeometry(this.boardSize, DEFAULT_BOARD_THICKNESS, this.boardSize);
    this.bare = new THREE.Mesh(boardGeometry, new THREE.MeshStandardMaterial({ color: bareColor, clippingPlanes: [this.bareEdge] }));
    this.paint = new THREE.Mesh(boardGeometry, new THREE.MeshStandardMaterial({ color: paintColor, clippingPlanes: [this.paintEdge] }));
    for (const board of [this.bare, this.paint]) board.position.y = BOARD_TOP_Y - DEFAULT_BOARD_THICKNESS / 2;

    this.can = buildSprayCan(this.unit, canColor);
    this.hammer = buildHammer(this.unit);
    scene.add(this.bare, this.paint, this.can, this.hammer);
  }

  /**
   * @param {{
   *   making: {paint:number, nails:number},
   *   settings: {nailCount:number, height:number},
   *   nails: {x:number, y:number}[], // 2D nail positions
   * }} frame
   */
  update({ making, settings, nails }) {
    this.#placePaintAndCan(making.paint);
    this.#placeHammer(making.nails, settings, nails);
  }

  #placePaintAndCan(paint) {
    const half = this.boardSize / 2;
    const edgeX = -half + paint * this.boardSize;
    this.paintEdge.constant = edgeX; // keeps x <= edgeX
    this.bareEdge.constant = -edgeX; // keeps x >= edgeX

    this.can.visible = paint > 0 && paint < 1;
    if (!this.can.visible) return;
    // Held above the wet edge, tipped over so the nozzle points down at the
    // board, sweeping from side to side as the edge advances.
    const sweep = Math.sin(paint * SPRAY_PASSES * 2 * Math.PI);
    this.can.position.set(edgeX - 900 * this.unit, 2900 * this.unit, sweep * half * 0.75);
    this.can.rotation.set(0, 0, -(Math.PI * 0.72));
  }

  #placeHammer(nailProgress, { nailCount, height }, nails) {
    this.hammer.visible = nailProgress > 0 && nailProgress < 1;
    if (!this.hammer.visible) return;
    const driven = nailProgress * nailCount;
    const index = Math.min(nailCount - 1, Math.floor(driven));
    const fraction = driven - index;
    const nail = nails[index];
    const { handleLength, headHalfHeight } = this.hammer.userData;

    // Grip outside the circle, handle pointing in at the nail from one side.
    const outward = Math.atan2(nail.y, nail.x) + (HAMMER_APPROACH_DEGREES * Math.PI) / 180;
    const outX = Math.cos(outward);
    const outZ = Math.sin(outward);
    // The nail's head is at its own height plus however far it still stands proud (see CardioidSceneSync).
    const nailTop = height * (1 + (1 - fraction) * 0.55);
    this.hammer.position.set(nail.x + outX * handleLength, nailTop + headHalfHeight, nail.y + outZ * handleLength);
    const swing = (hammerRaise(fraction, HAMMER_HITS_PER_NAIL) * HAMMER_SWING_DEGREES * Math.PI) / 180;
    // Yaw turns local +X (the handle) to face inward; the Z rotation then lifts the head about the grip.
    this.hammer.rotation.set(0, Math.atan2(outZ, -outX), swing);
  }

  dispose() {
    for (const root of [this.bare, this.paint, this.can, this.hammer]) {
      this.scene.remove(root);
      root.traverse((object) => {
        object.geometry?.dispose();
        object.material?.dispose();
      });
    }
  }
}
