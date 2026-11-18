/**
 * Editing transitions for every reel scene - a recipe's top-level
 * `transitions` list, each `{ type, t, seconds, ... }` centred on clip time
 * `t` (normalized 0..1, like a track keyframe) and lasting `seconds`:
 *
 * - `spin`: the picture turns a full circle about the line of sight, fastest
 *   at `t` (`turns`, default 1; negative turns the other way). Put a camera
 *   cut (`camera.shots`, see `core/reelCamera.js`) at `t` and it lands in the
 *   new shot - the classic spin transition.
 * - `whip`: a whip pan - the view swings sideways out of the shot, faster and
 *   faster, and swings in from the other side after `t` (`angle` degrees,
 *   default 70; negative swings left). Pair with a cut at `t`.
 * - `zoom`: punches in up to `t` and back out after (`zoom`, default 2.2: the
 *   view narrows to 1/2.2 of its width at `t`). Pair with a cut at `t`.
 * - `blur`: motion blur only, for a fast move the camera makes itself (a
 *   quick 360 orbit, a speed ramp).
 * - `flash`: a flash of `color` (default white) peaking at `t`, `strength`
 *   0..1 (default 0.85) - hides a cut or a light switching on.
 * - `dip`: through `color` (default black): out to it by `t`, back in after.
 *
 * `spin`, `whip`, `zoom` and `blur` are drawn with motion blur (the capture
 * averages `samples` moments across each frame's `shutter`, a fraction of a
 * frame, default 0.5); `flash` and `dip` are laid over in the edit pass.
 * Pure, no Three.js/DOM.
 */

const DEFAULT_SECONDS = { spin: 0.7, whip: 0.5, zoom: 0.6, blur: 0.6, flash: 0.35, dip: 0.8 };
const MOVES = new Set(['spin', 'whip', 'zoom', 'blur']);
const OVERLAYS = new Set(['flash', 'dip']);
export const TRANSITION_TYPES = Object.keys(DEFAULT_SECONDS);

const easeIn = (u) => u * u * u;
const easeOut = (u) => 1 - (1 - u) ** 3;
const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);

/** The recipe's transitions with their defaults filled in, in clip order. Unknown types are dropped. */
export function transitionList(recipe) {
  return (recipe?.transitions ?? [])
    .filter((tr) => DEFAULT_SECONDS[tr.type] !== undefined && typeof tr.t === 'number')
    .map((tr) => ({ ...tr, seconds: Math.max(0.05, tr.seconds ?? DEFAULT_SECONDS[tr.type]) }))
    .sort((a, b) => a.t - b.t);
}

/** How far through a transition's window clip time `t` is (0..1), or null outside it. */
function windowAt(tr, t, durationSeconds) {
  const half = tr.seconds / 2 / durationSeconds;
  if (t < tr.t - half || t > tr.t + half) return null;
  return (t - (tr.t - half)) / (2 * half);
}

/**
 * What the transitions add to the camera at clip time `t`: `roll` (degrees,
 * about the line of sight), `yaw` (degrees, the view swung right; negative
 * left) and `zoom` (1 = none, 2 = half the view's width).
 */
export function transitionCameraOffset(transitions, t, durationSeconds) {
  const offset = { roll: 0, yaw: 0, zoom: 1 };
  for (const tr of transitions) {
    const u = windowAt(tr, t, durationSeconds);
    if (u === null) continue;
    if (tr.type === 'spin') offset.roll += 360 * (tr.turns ?? 1) * easeInOut(u);
    else if (tr.type === 'whip') {
      const angle = tr.angle ?? 70;
      offset.yaw += u < 0.5 ? angle * easeIn(u * 2) : -angle * (1 - easeOut((u - 0.5) * 2));
    } else if (tr.type === 'zoom') {
      const peak = Math.max(1, tr.zoom ?? 2.2) - 1;
      offset.zoom *= 1 + peak * (u < 0.5 ? easeIn(u * 2) : 1 - easeOut((u - 0.5) * 2));
    }
  }
  return offset;
}

/**
 * The resolved camera with the recipe's transitions added (`roll` on top of
 * its own, plus `yaw` and `zoom` - see `reelRender.js#applyReelCamera`).
 */
export function withTransitions(pose, recipe, t) {
  const transitions = transitionList(recipe);
  if (!transitions.length) return pose;
  const offset = transitionCameraOffset(transitions, t, recipe.durationSeconds ?? 8);
  return { ...pose, roll: (pose.roll ?? 0) + offset.roll, yaw: offset.yaw, zoom: offset.zoom };
}

/**
 * How to blur the frame at clip time `t`: `{ shutter, samples }` (`shutter`
 * in clip time, the stretch the frame's `samples` moments are spread over),
 * or null for a sharp frame. Only inside a moving transition's window, plus a
 * frame either side. A spin, whip or zoom moves fastest at its middle, so
 * the moments per frame rise to `samples` (default 32) there - enough that a
 * fast-turning nail smears instead of showing as separate ghosts - and fall
 * to a few at the ends; `blur` keeps its `samples` (default 16) throughout.
 */
export function motionBlurAt(transitions, t, durationSeconds, fps = 30) {
  const frame = 1 / (fps * durationSeconds);
  let blur = null;
  for (const tr of transitions) {
    if (!MOVES.has(tr.type)) continue;
    const half = tr.seconds / 2 / durationSeconds + frame;
    if (Math.abs(t - tr.t) > half) continue;
    const shutter = Math.min(1, Math.max(0, tr.shutter ?? 0.5)) * frame;
    const u = windowAt(tr, t, durationSeconds);
    const speed = tr.type === 'blur' ? 1 : u === null ? 0 : (1 - Math.abs(2 * u - 1)) ** 2;
    const samples = Math.max(4, Math.ceil((tr.samples ?? (tr.type === 'blur' ? 16 : 32)) * speed));
    if (!blur || shutter * samples > blur.shutter * blur.samples) blur = { shutter, samples };
  }
  return blur && blur.shutter > 0 ? blur : null;
}

/**
 * The flashes and dips for the edit pass, in seconds: `{ color, strength,
 * start, peak, end }` - the overlay fades in from `start`, is at `strength`
 * at `peak`, and is gone by `end`.
 */
export function transitionOverlays(transitions, durationSeconds) {
  return transitions
    .filter((tr) => OVERLAYS.has(tr.type))
    .map((tr) => {
      const peak = tr.t * durationSeconds;
      // A flash bursts in fast and fades slowly; a dip goes out and comes back evenly.
      const before = tr.type === 'flash' ? tr.seconds * 0.2 : tr.seconds / 2;
      return {
        color: tr.color ?? (tr.type === 'flash' ? '#ffffff' : '#000000'),
        strength: Math.min(1, Math.max(0, tr.strength ?? (tr.type === 'flash' ? 0.85 : 1))),
        start: Math.max(0, peak - before),
        peak,
        end: Math.min(durationSeconds, peak + tr.seconds - before),
      };
    });
}

/** The stretches of clip time (normalized `[from, to]`) a moving transition covers - where a fast turn is meant. */
export function transitionWindows(transitions, durationSeconds) {
  return transitions
    .filter((tr) => MOVES.has(tr.type))
    .map((tr) => {
      const half = tr.seconds / 2 / durationSeconds;
      return [tr.t - half, tr.t + half];
    });
}
