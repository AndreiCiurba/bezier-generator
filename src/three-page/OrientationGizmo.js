import * as THREE from 'three';

// Screen-space pixel footprint of the gizmo's square viewport, and its
// margin from the canvas edges - fixed to the bottom-right corner, per the
// epic's "persistent XYZ orientation legend" requirement.
const GIZMO_SIZE = 110;
const GIZMO_MARGIN = 16;

// The gizmo camera orbits a small fixed-size scene at this constant
// distance - arbitrary, since nothing in the gizmo scene is drawn to any
// real-world scale.
const GIZMO_CAMERA_DISTANCE = 4;
const AXIS_LENGTH = 1.6;

const AXES = [
  { direction: new THREE.Vector3(1, 0, 0), color: 0xff5555, label: 'X' },
  { direction: new THREE.Vector3(0, 1, 0), color: 0x55ff77, label: 'Y' },
  { direction: new THREE.Vector3(0, 0, 1), color: 0x5599ff, label: 'Z' },
];

function makeAxisLabel(text, color) {
  const canvasSize = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvasSize / 2, canvasSize / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.6, 0.6, 1);
  return sprite;
}

/**
 * A persistent XYZ orientation legend, fixed to the viewport's bottom-right
 * corner rather than moving with the 3D scene - the epic's own requirement.
 *
 * Standard "orientation gizmo" technique: a tiny separate scene (three
 * colored `ArrowHelper`s + text-label sprites) with its own camera, whose
 * *rotation only* mirrors the currently-active camera's orientation every
 * frame - so orbiting the main camera (or, in Drawing Mode, the locked
 * top-down camera) correspondingly re-orients the little axes cluster,
 * always showing which way is actually up/right/forward right now (a
 * static label can't do that mid-orbit). Rendered into a small scissored
 * rectangle of the *same* `WebGLRenderer`/canvas, not a second canvas/
 * context. Which camera to mirror is passed into `render()` each frame
 * (not fixed at construction) - ThreeApp has more than one camera
 * (perspective inspection vs. Drawing Mode's orthographic) and only one is
 * ever actually active/rendered at a time.
 */
export class OrientationGizmo {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 20);

    for (const { direction, color, label } of AXES) {
      const arrow = new THREE.ArrowHelper(direction, new THREE.Vector3(0, 0, 0), AXIS_LENGTH, color, 0.5, 0.35);
      this.scene.add(arrow);

      const sprite = makeAxisLabel(label, `#${color.toString(16).padStart(6, '0')}`);
      sprite.position.copy(direction).multiplyScalar(AXIS_LENGTH + 0.35);
      this.scene.add(sprite);
    }

    this._fullSize = new THREE.Vector2();
    this._gizmoOffset = new THREE.Vector3();
  }

  /**
   * Renders the gizmo into its fixed bottom-right rectangle of `renderer`'s
   * current canvas, then restores the full viewport/scissor state so the
   * *next* frame's main-scene render is unaffected.
   * @param {import('three').WebGLRenderer} renderer
   * @param {import('three').Camera} activeCamera whose current orientation to mirror
   */
  render(renderer, activeCamera) {
    renderer.getSize(this._fullSize);
    const x = this._fullSize.x - GIZMO_SIZE - GIZMO_MARGIN;
    // Viewport Y is measured from the canvas's *bottom* edge (WebGL
    // convention) - a small Y here already means "near the bottom of the
    // screen", i.e. exactly the bottom-right corner the epic asks for.
    const y = GIZMO_MARGIN;

    this.camera.position
      .copy(this._gizmoOffset.set(0, 0, GIZMO_CAMERA_DISTANCE).applyQuaternion(activeCamera.quaternion));
    this.camera.up.copy(activeCamera.up);
    this.camera.lookAt(0, 0, 0);

    renderer.setViewport(x, y, GIZMO_SIZE, GIZMO_SIZE);
    renderer.setScissor(x, y, GIZMO_SIZE, GIZMO_SIZE);
    renderer.setScissorTest(true);

    // `renderer.render()` auto-clears (color + depth) by default, which
    // would wipe the just-rendered main scene's pixels within this rect
    // before drawing the gizmo - disabling it and clearing depth only
    // (respecting the active scissor rect) keeps the main scene visible as
    // the gizmo's backdrop instead of a flat clear color.
    const previousAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = previousAutoClear;

    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, this._fullSize.x, this._fullSize.y);
  }
}
