import * as THREE from 'three';
import { resolveCardioidFrame } from './cardioidReelFrame.js';
import { circleNailPositions } from '../core/cardioidWeave.js';
import { MakingProps } from './reelProps.js';
import { applyReelCamera, buildBloomComposer, frameSize, lineWidthScale, readPixelsBase64 } from '../three-page/reelRender.js';

/**
 * Drives the Cardioid board deterministically from a JSON recipe - this
 * page's counterpart of `three-page/ReelTimeline.js`, with the same
 * `load()` / `seek(t)` / `getFrameSize()` / `readPixelsBase64()` surface, so
 * tools/reel-pipeline's headless capture drives either page the same way.
 * Reachable only as `window.__reelTimeline`, and only when the page is opened
 * with `?reel=1` (see `CardioidApp.js`).
 *
 * All the timeline math is the pure `resolveCardioidFrame`; this class only
 * applies its result: rebuild the weave (`CardioidSceneSync#rebuild` already
 * rebuilds from scratch on every settings change, so a frame is just one more
 * of those), place the camera, render one frame. `seek(t)` is a pure function
 * of `t` - never of elapsed time - so a slow capture still gives a perfectly
 * even video.
 *
 * `recipe.look` is what the picture is dressed in, set once per clip:
 * - `background`: scene background color.
 * - `board`: `false` hides the wooden board (strings floating in the dark),
 *   or a hex color repaints it.
 * - `nailColor`: hex color for the nails (shown when `weave.nailsVisible`).
 * - `bloom`: `{ strength, radius, threshold }` - a glow around the strings
 *   (Three's own `UnrealBloomPass`). The post-processing modules are imported
 *   only when a recipe asks for it, so the normal page never loads them.
 *
 * A recipe with a `making` section also gets the making-of props (paint going
 * on, spray can, hammer - see `reelProps.js`). There, `look.board` is
 * the bare board's color and `making.paintColor` what it is sprayed.
 */
export class CardioidReel {
  /**
   * @param {{
   *   camera: import('three').PerspectiveCamera,
   *   controls: import('three/addons/controls/OrbitControls.js').OrbitControls,
   *   renderer: import('three').WebGLRenderer,
   *   scene: import('three').Scene,
   *   sceneSync: import('./CardioidSceneSync.js').CardioidSceneSync,
   * }} deps
   */
  constructor({ camera, controls, renderer, scene, sceneSync }) {
    this.camera = camera;
    this.controls = controls;
    this.renderer = renderer;
    this.scene = scene;
    this.sceneSync = sceneSync;
    this.recipe = null;
    this.composer = null;
    this.props = null;
  }

  /** Call once per clip, before the first `seek()`. */
  async load(recipe) {
    this.recipe = recipe;
    this.controls.enabled = false; // scripted playback owns the camera from here on

    const look = recipe.look ?? {};
    if (look.background) this.scene.background = new THREE.Color(look.background);
    if (look.nailColor) this.sceneSync.nailMaterial.color.set(look.nailColor);
    this.composer = look.bloom ? await buildBloomComposer(this.renderer, this.scene, this.camera, look.bloom) : null;

    this.props?.dispose();
    this.props = null;
    if (recipe.making) {
      this.renderer.localClippingEnabled = true; // the paint is cut off at the edge the can has reached
      const { radius } = resolveCardioidFrame(recipe, 0).settings;
      this.props = new MakingProps(this.scene, {
        radius,
        bareColor: typeof look.board === 'string' ? look.board : '#b08a5a',
        paintColor: recipe.making.paintColor ?? '#14141b',
        canColor: recipe.making.canColor ?? '#d9dde3',
      });
    }
  }

  /**
   * Applies the recipe at normalized clip time `t` and renders exactly one frame.
   * @param {number} t
   */
  seek(t) {
    const { settings, camera, making } = resolveCardioidFrame(this.recipe, t);
    const board = this.recipe.look?.board;
    // String width is in screen pixels, so the same recipe would look
    // heavier in a small preview than in the full-size render. Scaling it to
    // the frame keeps a preview an honest miniature of the final clip.
    const widthScale = lineWidthScale(this.renderer);
    this.sceneSync.rebuild({
      ...settings,
      weight: settings.weight * widthScale,
      boardVisible: board !== false && !this.props, // a making-of reel's board belongs to its props
      boardColor: typeof board === 'string' ? board : undefined,
    });

    applyReelCamera(this.camera, camera);

    if (this.props) {
      this.props.update({ making, settings, nails: circleNailPositions(settings.nailCount, settings.radius) });
    }

    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  /** The drawing buffer's real size in device pixels - what `readPixelsBase64()` returns. */
  getFrameSize() {
    return frameSize(this.renderer);
  }

  /** The current frame's raw RGBA pixels, base64-encoded, bottom row first. */
  readPixelsBase64() {
    return readPixelsBase64(this.renderer);
  }
}
