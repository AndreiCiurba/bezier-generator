import { Pattern } from '../models/Pattern.js';
import { interpolateNumber, interpolateColor, wobble } from '../core/keyframe.js';
import { WovenReel } from './WovenReel.js';
import { prepareGrid, resolveGridFrame } from './gridReelFrame.js';

// Same orbit target as ThreeApp's own ORBIT_TARGET - the board is always
// centered at world X/Z = 0 (see SceneSync's origin shift), so a scripted
// orbit camera looks at the same fixed point ThreeApp's own OrbitControls
// does. Not imported from ThreeApp.js (a private module-level const there)
// - duplicated as the one genuinely shared fact between the two files.
const ORBIT_TARGET = { x: 0, y: 0, z: 0 };

/**
 * Drives `/3d`'s scene deterministically from a JSON "recipe" of keyframe
 * tracks - the in-app half of the reel pipeline (see
 * tools/reel-pipeline/render.js for the headless-capture half). Built for
 * an external driver (Puppeteer) to call `load()` once, then `seek(t)`
 * once per output frame with an increasing, evenly-spaced `t` - never tied
 * to real elapsed time or `requestAnimationFrame`, so a slow headless
 * render (screenshotting every frame) still produces a perfectly smooth,
 * consistent-frame-rate video: `seek(t)` is a pure function of `t`, not of
 * wall-clock time.
 *
 * Reuses existing app machinery rather than duplicating it:
 * - Camera: sets `camera.position`/`lookAt` directly, the same pair of
 *   calls `ThreeApp#applyDefaultCameraView` makes, just orbiting over time
 *   instead of a single fixed pose. `OrbitControls` is disabled for the
 *   duration (`controls.enabled = false`) the same way Drawing Mode already
 *   hands off camera control (see `ThreeApp#enterDrawingMode`). Radius/
 *   height can be a plain constant or their own keyframe track (see
 *   `#resolveCameraParam`) - e.g. radius dropping toward 0 mid-clip flies
 *   the camera through the center of the board and out the other side.
 *   An optional `wobble` config per parameter (see `keyframe.js#wobble`)
 *   layers deterministic, non-repeating-looking jitter on top, for a less
 *   mechanically smooth path.
 * - Color: calls `palette.setColor(index, hex)` per layer per frame - this
 *   already triggers `StrokePalette#onChange` -> `ThreeApp#refreshLivePatternCurves`,
 *   which recolors and rebuilds every *live Auto-mode* curve. No new
 *   recolor path needed - see `models/Curve.js#isLiveAutoPatternCurve`.
 * - Nail height: calls `sceneSync.setNailHeight(height)` directly - already
 *   a cheap instance-matrix rewrite, not a geometry rebuild.
 * - Deformation: calls `deformation.movePin`/`addPin` - the exact calls the
 *   live pin-drag path in `ThreeApp#handleCanvasPointerMove` already makes.
 *
 * `sceneSync.deformation` (not a separately-passed `DeformableGrid`) is read
 * fresh on every call rather than cached, so this class keeps working
 * correctly even if the grid is rebuilt (`ThreeApp#handleGridChange` swaps
 * `SceneSync`'s underlying deformation instance) - though in practice no
 * recipe should resize the grid mid-clip.
 */
export class ReelTimeline {
  /**
   * @param {{
   *   camera: import('three').Camera,
   *   controls: import('three/addons/controls/OrbitControls.js').OrbitControls,
   *   renderer: import('three').WebGLRenderer,
   *   scene: import('three').Scene,
   *   palette: import('../state/StrokePalette.js').StrokePalette,
   *   sceneSync: import('./SceneSync.js').SceneSync,
   *   patterns: import('../state/PatternStore.js').PatternStore,
   *   stamper: import('../app/PatternStamper.js').PatternStamper,
   * }} deps
   */
  constructor({ camera, controls, renderer, scene, palette, sceneSync, patterns, stamper }) {
    this.camera = camera;
    this.controls = controls;
    this.renderer = renderer;
    this.scene = scene;
    this.palette = palette;
    this.sceneSync = sceneSync;
    this.patterns = patterns;
    this.stamper = stamper;
    this.recipe = null;
    // DeformableGrid Pin instances created for the recipe's deformation
    // track (if any), one per `recipe.deformation.pins` entry, index-aligned
    // - created once in `load()` since a pin has real identity (radius/
    // falloff/id) that a fresh `addPin` call every `seek()` would churn.
    this._deformationPins = [];
  }

  /**
   * Loads a recipe: imports and auto-fills the grid with its referenced
   * pattern (stamped in Auto mode, so every already-placed curve keeps
   * recoloring live as the color track plays - see class doc), creates any
   * deformation pins the recipe declares, and hands the camera over from
   * `OrbitControls` to this class's own scripted orbit. Call once per clip,
   * before the first `seek()`.
   *
   * A recipe with no `pattern` field is allowed (e.g. a camera-only or
   * nail-height-only recipe against a hand-drawn design already on
   * screen) - the auto-fill step is simply skipped.
   * @param {object} recipe see tools/reel-pipeline/recipes/ for real examples
   */
  async load(recipe) {
    // A `"scene": "grid"` recipe describes the whole board itself (see
    // gridReelFrame.js) rather than replaying a saved pattern on this page's
    // own grid, so it is handed to a `WovenReel` that draws it in place of
    // everything this page put in the scene.
    if (recipe.scene === 'grid') {
      this.delegate = new WovenReel({
        camera: this.camera, renderer: this.renderer, scene: this.scene, controls: this.controls,
        resolve: resolveGridFrame, prepare: prepareGrid,
        hide: this.scene.children.filter((object) => !object.isLight),
      });
      return this.delegate.load(recipe);
    }
    this.recipe = recipe;

    // Resize before stamping, not that it strictly matters for the final
    // look - every already-stamped Auto-mode curve gets its colors replaced
    // wholesale on the very first `#applyColors` call anyway (see that
    // method's doc) - but it keeps "how many colors" and "what stamps"
    // happening in the order a recipe author would expect.
    if (recipe.colorCount) this.palette.resize(recipe.colorCount);

    if (recipe.pattern) {
      const response = await fetch(recipe.pattern);
      if (!response.ok) throw new Error(`ReelTimeline: failed to fetch pattern "${recipe.pattern}" (${response.status})`);
      const rawPatterns = await response.json();
      if (!Array.isArray(rawPatterns) || rawPatterns.length === 0) {
        throw new Error(`ReelTimeline: "${recipe.pattern}" contains no patterns - export one from the Patterns panel first`);
      }
      this.patterns.importPatterns(rawPatterns, Pattern);
      const patternId = recipe.patternId ?? rawPatterns[0].id;
      this.patterns.select(patternId, true);
      if (this.patterns.placementMode !== 'auto') this.patterns.togglePlacementMode();
      this.stamper.stampThroughoutGrid(recipe.strokeWeight ?? null);
    }

    this._deformationPins = (recipe.deformation?.pins ?? []).map((pinRecipe) =>
      this.sceneSync.deformation.addPin({
        referencePosition: pinRecipe.referencePosition,
        radius: pinRecipe.radius,
        falloff: pinRecipe.falloff,
      })
    );

    // Inner nails (the slim weave-subdivision pins standing at every curve's
    // own points) read as clutter in a posted clip, not a feature - hidden
    // by default. `showInnerNails: true` opts back in for a recipe that
    // specifically wants them.
    this.sceneSync.setInnerNailsVisible(recipe.showInnerNails ?? false);

    // Scripted playback owns the camera for the rest of this recipe's life -
    // same handoff `ThreeApp#enterDrawingMode` already does for its own
    // locked top-down camera.
    this.controls.enabled = false;
  }

  /**
   * Applies every track at normalized clip time `t` (clamped to [0, 1]) and
   * renders exactly one frame - synchronously, independent of the RAF loop,
   * so an external driver can call this then immediately screenshot a fully
   * up-to-date frame with no reliance on timing.
   * @param {number} t
   */
  seek(t) {
    if (this.delegate) return this.delegate.seek(t);
    const clamped = Math.min(1, Math.max(0, t));
    this.#applyCamera(clamped);
    this.#applyColors(clamped);
    this.#applyNailHeight(clamped);
    this.#applyDeformation(clamped);
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Resolves one camera parameter (radius/height) at time `t`: either a
   * plain constant number (the simple "fixed-radius orbit" case every
   * existing recipe uses), or a full `{ keyframes, easing }` track for a
   * value that itself changes over the clip - e.g. radius dropping toward 0
   * mid-clip to fly through the center of the board, then back out the
   * other side.
   * @param {number|{keyframes: {t:number,value:number}[], easing?: string}} spec
   * @param {number} t
   */
  #resolveCameraParam(spec, t) {
    if (typeof spec === 'number') return spec;
    return interpolateNumber(spec.keyframes, t, spec.easing);
  }

  #applyCamera(t) {
    const camera = this.recipe.camera;
    if (!camera) return;

    // `angleKeyframes` (raw degree values with their own timing) is the
    // escape hatch for a non-linear sweep - e.g. slow near the ends, fast
    // through the middle, or looping past 360 for more than one revolution.
    // The plain startAngle/endAngle pair (linear sweep) remains the default
    // for the common case, so every existing recipe keeps working unchanged.
    const angleDegrees = camera.angleKeyframes
      ? interpolateNumber(camera.angleKeyframes, t, camera.easing)
      : interpolateNumber(
          [
            { t: 0, value: camera.startAngle ?? 0 },
            { t: 1, value: camera.endAngle ?? 360 },
          ],
          t,
          camera.easing
        );
    const angleRadians = (angleDegrees * Math.PI) / 180;
    const radius = this.#resolveCameraParam(camera.radius ?? 900, t) + wobble(t, camera.wobble?.radius);
    const height = this.#resolveCameraParam(camera.height ?? 500, t) + wobble(t, camera.wobble?.height);
    const wobbledAngleRadians = angleRadians + (wobble(t, camera.wobble?.angleDegrees) * Math.PI) / 180;

    this.camera.position.set(
      ORBIT_TARGET.x + radius * Math.cos(wobbledAngleRadians),
      ORBIT_TARGET.y + height,
      ORBIT_TARGET.z + radius * Math.sin(wobbledAngleRadians)
    );
    this.camera.lookAt(ORBIT_TARGET.x, ORBIT_TARGET.y, ORBIT_TARGET.z);
  }

  /**
   * Applies every color track for this frame in one batch (`StrokePalette
   * #setColors`), not one `setColor` call per layer - each `setColor` call
   * would separately trigger the palette's `onChange` listeners, and on
   * this page that includes `ThreeApp#refreshLivePatternCurves`, which
   * disposes/rebuilds every live curve's geometry. With a real recipe
   * animating a couple dozen layers (e.g. a 25-color palette), that's the
   * difference between one geometry rebuild per frame and two dozen.
   */
  #applyColors(t) {
    const tracks = this.recipe.colors ?? [];
    if (tracks.length === 0) return;
    const updates = tracks.map((track) => {
      const keyframes = track.keyframes.map((k) => ({ t: k.t, value: k.color }));
      return { index: track.layer, hex: interpolateColor(keyframes, t, track.easing) };
    });
    this.palette.setColors(updates);
  }

  /**
   * The renderer's actual drawing-buffer size in device pixels - what
   * `readPixelsBase64()` will return exactly that many pixels for. Exposed
   * so a driver can size its ffmpeg `rawvideo` input correctly without
   * assuming it matches the CSS viewport size (they're normally equal here
   * since the pipeline sets `deviceScaleFactor: 1`, but reading the real
   * value is one call and removes the assumption entirely).
   * @returns {{width:number, height:number}}
   */
  getFrameSize() {
    const gl = this.renderer.getContext();
    return { width: gl.drawingBufferWidth, height: gl.drawingBufferHeight };
  }

  /**
   * Reads the current frame's raw RGBA pixels straight off the WebGL
   * context (`gl.readPixels`) and returns them base64-encoded - the
   * "raw pixel pipe" alternative to `canvas.screenshot()` (see
   * tools/reel-pipeline/render.js's `--raw` mode): no per-frame PNG encode
   * in Chrome and no PNG decode in ffmpeg, just a straight byte copy in
   * both directions. Base64 (not a raw byte array) is what actually makes
   * this fast to pull out of the page: Puppeteer's `page.evaluate` returns
   * values through JSON, and a JSON array of ~8 million individual byte
   * numbers (a 1080x1920 RGBA frame) serializes far slower than one long
   * string does.
   *
   * Requires `preserveDrawingBuffer: true` on the renderer (see
   * `ThreeApp.js`'s `REEL_MODE` gate) - without it there's no guarantee the
   * drawing buffer still holds this frame's pixels by the time this runs,
   * the same hazard that setting existed to fix for `canvas.screenshot()`.
   *
   * WebGL's row order is bottom-to-top (OpenGL convention), opposite of
   * every normal image/video format - `render.js`'s ffmpeg invocation for
   * `--raw` mode applies a `vflip` filter to correct it, rather than
   * flipping rows here on every frame.
   * @returns {string} base64-encoded RGBA bytes, `width * height * 4` long once decoded
   */
  readPixelsBase64() {
    const gl = this.renderer.getContext();
    const { width, height } = this.getFrameSize();
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // Chunked to avoid blowing the engine's call-stack/argument-count limit
    // that `String.fromCharCode(...pixels)` (or `.apply` on the full array)
    // hits well before a full HD frame's byte count.
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < pixels.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, pixels.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  #applyNailHeight(t) {
    const track = this.recipe.nailHeight;
    if (!track) return;
    this.sceneSync.setNailHeight(interpolateNumber(track.keyframes, t, track.easing));
  }

  #applyDeformation(t) {
    const pinTracks = this.recipe.deformation?.pins ?? [];
    if (pinTracks.length === 0) return;

    for (let i = 0; i < pinTracks.length; i++) {
      const track = pinTracks[i];
      const pin = this._deformationPins[i];
      const x = interpolateNumber(track.keyframes.map((k) => ({ t: k.t, value: k.x })), t, track.easing);
      const y = interpolateNumber(track.keyframes.map((k) => ({ t: k.t, value: k.y })), t, track.easing);
      this.sceneSync.deformation.movePin(pin, { x, y });
    }
    this.sceneSync.syncNailPositions();
  }
}
