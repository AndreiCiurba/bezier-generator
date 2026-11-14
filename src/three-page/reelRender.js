import * as THREE from 'three';

/**
 * Three.js helpers every reel scene shares (`cardioid/CardioidReel.js`,
 * `arrange/ArrangeReel.js`, `three-page/GridReel.js`): placing the camera
 * from a resolved orbit camera (see `core/reelCamera.js`), the optional
 * bloom glow, and reading the frame size.
 */

// A recipe's string weight means "this heavy in a full-size 1080-wide reel".
export const REFERENCE_FRAME_WIDTH = 1080;

/** The drawing buffer's real size in device pixels. */
export function frameSize(renderer) {
  const gl = renderer.getContext();
  return { width: gl.drawingBufferWidth, height: gl.drawingBufferHeight };
}

/** How much to scale a screen-pixel line width so a preview is an honest miniature of the full-size reel. */
export function lineWidthScale(renderer) {
  return frameSize(renderer).width / REFERENCE_FRAME_WIDTH;
}

/**
 * Puts `camera` where `resolveOrbitCamera` says. Tilt and roll turn it in
 * place after aiming: tilt pitches the view up, roll spins it about its own axis.
 * @param {import('three').PerspectiveCamera} camera
 * @param {{position:{x:number,y:number,z:number}, target:{x:number,y:number,z:number}, fov:number, roll:number, tilt:number}} pose
 */
export function applyReelCamera(camera, pose) {
  camera.position.set(pose.position.x, pose.position.y, pose.position.z);
  camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
  if (pose.tilt) camera.rotateX((pose.tilt * Math.PI) / 180);
  if (pose.roll) camera.rotateZ((pose.roll * Math.PI) / 180);
  if (camera.fov !== pose.fov) {
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
  }
}

/**
 * A glow around the strings (Three's own `UnrealBloomPass`). The
 * post-processing modules are imported only when a recipe asks for bloom, so
 * the normal pages never load them.
 * @returns {Promise<{render: () => void}>}
 */
export async function buildBloomComposer(renderer, scene, camera, { strength = 0.6, radius = 0.4, threshold = 0.2 }) {
  const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
    import('three/addons/postprocessing/EffectComposer.js'),
    import('three/addons/postprocessing/RenderPass.js'),
    import('three/addons/postprocessing/UnrealBloomPass.js'),
    import('three/addons/postprocessing/OutputPass.js'),
  ]);
  const { width, height } = frameSize(renderer);
  // Multisampled, because the canvas's own antialiasing does not apply to
  // an offscreen target and thin strings alias badly without it.
  const target = new THREE.WebGLRenderTarget(width, height, { samples: 4, type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(width, height), strength, radius, threshold));
  composer.addPass(new OutputPass());
  return composer;
}

/**
 * The current frame's raw RGBA pixels, base64-encoded, bottom row first -
 * see `ReelTimeline#readPixelsBase64` for why this shape.
 */
export function readPixelsBase64(renderer) {
  const gl = renderer.getContext();
  const { width, height } = frameSize(renderer);
  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < pixels.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, pixels.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
