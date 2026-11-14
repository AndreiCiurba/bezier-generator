import { resolveTrack, resolveColor, colorGradient, resolveOrbitCamera, REEL_CAMERA_DEFAULTS } from '../core/reelCamera.js';

export { resolveTrack, REEL_CAMERA_DEFAULTS };

/**
 * Pure "what does the Cardioid board look like at clip time t" for the reel
 * pipeline (see `CardioidReel.js` for the Three.js half that applies it, and
 * tools/reel-pipeline/ for the headless capture that drives it). No Three.js/
 * DOM dependency, so a recipe's whole timeline can be tested directly.
 *
 * A cardioid recipe (`"scene": "cardioid"`):
 * - `weave`: any of the board's own settings (`nailCount`, `layerCount`,
 *   `leap`, `multiplier`, `radius`, `height`, `weight`, `nailThickness`), plus
 *   `drawProgress` (0..1 - how much of the weave is strung yet) - each either
 *   a plain number or a track (below). `drawMode`, `showWrap` and
 *   `nailsVisible` are plain values.
 * - `colors`: a list of hex colors, each either a plain string or a
 *   `{ keyframes: [{ t, color }], easing }` track. `colorMode` says how they
 *   are used: `"arc"` (the board's own look - each layer split into one arc
 *   per color) or `"layer"` (a gradient through the colors up the stack, one
 *   color per layer).
 * - `camera`: `azimuth` (degrees round the board), `elevation` (degrees
 *   above the board plane: 0 = side-on, 90 = straight down), `distance`,
 *   `targetX`/`targetY`/`targetZ` (the point looked at; Y is up), `fov`,
 *   `roll` and `tilt` (degrees) - each a number or a track. `tilt` pitches
 *   the camera up from where it would otherwise look, without moving it: a
 *   camera hanging straight above the piece (`elevation` 90) with `tilt` 90
 *   is looking horizontally. Distances and target
 *   offsets are in *circle radii*, not world units, so a recipe frames the
 *   same whatever `weave.radius` is.
 * - `making` (optional): the "setting the board up" stages of a making-of
 *   reel, each a number or track from 0 to 1 - `paint` (how much of the bare
 *   board has been sprayed with `paintColor`) and `nails` (how many of the
 *   nails are hammered in). `CardioidReel` adds the spray can and hammer.
 * - `explain` (optional): `{ chord, color, weight }` picks out one string of
 *   the bottom layer in a bold contrasting line, for a reel that explains the
 *   rule. `chord` is which start nail (a number or track; fractional values
 *   slide between nails), so stepping it 1, 2, 3 ... walks through "nail 1
 *   goes to nail 2, nail 2 to nail 4, nail 3 to nail 6". Off when `chord` is
 *   0 or negative.
 *
 * A track is `{ keyframes: [{ t, value }], easing, wobble }` with `t`
 * normalized to the clip (0..1), exactly like `/3d`'s recipes; `wobble`
 * (`{ amplitude, frequency, seed }`, see `keyframe.js`) layers handheld-style
 * drift on top. `{ value, wobble }` is a constant with drift.
 */

export const REEL_WEAVE_DEFAULTS = {
  nailCount: 120,
  layerCount: 6,
  leap: 2,
  multiplier: 2,
  radius: 3000,
  height: 600,
  weight: 0.5,
  nailThickness: 0,
  drawProgress: 1,
};

// Counts of things: a recipe may tween them, but half a nail means nothing.
const WHOLE_NUMBER_KEYS = new Set(['nailCount', 'layerCount']);

/**
 * One color per layer: a gradient through `colors`, first color on the bottom
 * layer and last on the top one.
 * @param {string[]} colors
 * @param {number} layerCount
 * @returns {string[]}
 */
export function layerGradient(colors, layerCount) {
  return colorGradient(colors, layerCount);
}

/**
 * One nail's hammering, as the hammer sees it: `fraction` (0..1) is how far
 * through driving this nail we are, split into `hits` equal blows. Each blow
 * lifts the hammer quickly and brings it down accelerating, meeting the nail
 * exactly as the blow ends.
 * @param {number} fraction
 * @param {number} [hits]
 * @returns {number} how far the hammer is raised: 1 at the top of a swing, 0 in contact with the nail
 */
export function hammerRaise(fraction, hits = 3) {
  const phase = Math.min(1, Math.max(0, fraction)) * hits;
  const within = phase - Math.floor(phase);
  const LIFT_SHARE = 0.55; // of each blow spent raising the hammer
  if (within < LIFT_SHARE) return 1 - (1 - within / LIFT_SHARE) ** 2;
  return 1 - ((within - LIFT_SHARE) / (1 - LIFT_SHARE)) ** 2;
}

const clamp01 = (value) => Math.min(1, Math.max(0, value));

/**
 * @param {object} recipe see the module doc
 * @param {number} t normalized clip time, clamped to [0, 1]
 * @returns {{
 *   settings: object, // ready for `CardioidSceneSync#rebuild`
 *   camera: {position:{x:number,y:number,z:number}, target:{x:number,y:number,z:number}, fov:number, roll:number, tilt:number},
 *   making: {paint:number, nails:number}|null,
 * }} `camera.roll` and `camera.tilt` are in degrees; `making` is null for a recipe without that section
 */
export function resolveCardioidFrame(recipe, t) {
  const time = Math.min(1, Math.max(0, t));
  const weave = recipe.weave ?? {};

  const numbers = {};
  for (const [key, fallback] of Object.entries(REEL_WEAVE_DEFAULTS)) {
    const value = resolveTrack(weave[key], time, fallback);
    numbers[key] = WHOLE_NUMBER_KEYS.has(key) ? Math.max(1, Math.round(value)) : value;
  }

  const colors = (recipe.colors ?? ['#ffffff']).map((spec) => resolveColor(spec, time));
  const making = recipe.making
    ? {
        paint: clamp01(resolveTrack(recipe.making.paint, time, 1)),
        nails: clamp01(resolveTrack(recipe.making.nails, time, 1)),
      }
    : null;
  const settings = {
    ...numbers,
    nailProgress: making ? making.nails : 1,
    highlight: recipe.explain
      ? { chord: resolveTrack(recipe.explain.chord, time, 0), color: recipe.explain.color ?? '#ffffff', weight: recipe.explain.weight ?? 2.2 }
      : null,
    colors,
    layerColors: recipe.colorMode === 'layer' ? layerGradient(colors, numbers.layerCount) : null,
    drawMode: weave.drawMode ?? 'sequential',
    showWrap: weave.showWrap ?? false,
    nailsVisible: weave.nailsVisible ?? false,
  };

  return {
    settings,
    camera: resolveOrbitCamera(recipe.camera, time, numbers.radius),
    making,
  };
}
