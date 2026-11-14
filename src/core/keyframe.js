/**
 * Pure keyframe interpolation for the Reel Timeline (see
 * ../three-page/ReelTimeline.js) - no Three.js/DOM dependency, so a
 * recipe's numeric/color tracks can be tested directly against known
 * inputs/outputs, the same way every other pure math module under
 * src/core/ is.
 *
 * A track is a list of `{ t, value }` keyframes, `t` normalized to [0, 1]
 * (a recipe's own clip-relative time, not wall-clock seconds - the
 * timeline's own `seek(t)` already works in that same normalized space).
 * Keyframes don't need to be pre-sorted - both functions below sort a copy
 * before locating, so recipe authors can list them in whatever order reads
 * best. Time outside the first/last keyframe holds at that keyframe's
 * value (no extrapolation) - a track that only wants to change during part
 * of the clip just doesn't need entries covering the rest.
 *
 * A keyframe may carry its own `easing`, which shapes the move that arrives
 * at it and overrides the track's - so one camera track can drift, snap and
 * drift again.
 */

const EASINGS = {
  linear: (t) => t,
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2),
  // The rest exist for reel camera moves: a push-in that starts fast and
  // settles (`easeOutCubic`), one that winds up slowly then rushes
  // (`easeInCubic`), and a firmer start/stop than the quad version
  // (`easeInOutCubic`).
  easeInCubic: (t) => t ** 3,
  easeOutCubic: (t) => 1 - (1 - t) ** 3,
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - ((-2 * t + 2) ** 3) / 2),
  // The whip moves: nearly all of the travel happens in a moment, with a
  // long settle after it (`easeOutExpo`) or a long wind-up and settle either
  // side of it (`easeInOutExpo`) - a snap zoom, a flip, a whip round.
  easeOutExpo: (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
  easeInOutExpo: (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2;
  },
};

/**
 * Resolves an easing function from either a name (looked up in EASINGS,
 * falling back to `linear` for an unknown/omitted name - a typo'd easing
 * name in a recipe should never crash a render, just look linear) or a
 * function passed through as-is (so tests, or an advanced recipe loader,
 * can supply their own).
 * @param {string|((t:number)=>number)} [easing]
 * @returns {(t:number)=>number}
 */
export function resolveEasing(easing) {
  if (typeof easing === 'function') return easing;
  return EASINGS[easing] ?? EASINGS.linear;
}

/**
 * Finds the keyframe pair `t` falls between (after sorting a copy of
 * `keyframes` ascending by `.t`) and the eased local progress between them.
 * `t` at-or-before the first keyframe, or at-or-after the last, resolves to
 * that single keyframe with progress 0 - the caller ends up lerping a value
 * against itself, which is just that endpoint's value.
 * @param {{t:number, value:*}[]} keyframes
 * @param {number} t
 * @param {string|((t:number)=>number)} [easing]
 */
function locate(keyframes, t, easing) {
  if (keyframes.length === 0) throw new Error('keyframe interpolation requires at least one keyframe');
  const sorted = [...keyframes].sort((a, b) => a.t - b.t);
  if (sorted.length === 1 || t <= sorted[0].t) return { from: sorted[0], to: sorted[0], progress: 0 };
  const last = sorted[sorted.length - 1];
  if (t >= last.t) return { from: last, to: last, progress: 0 };

  for (let i = 0; i < sorted.length - 1; i++) {
    const from = sorted[i];
    const to = sorted[i + 1];
    if (t >= from.t && t <= to.t) {
      const span = to.t - from.t;
      const localT = span === 0 ? 0 : (t - from.t) / span;
      return { from, to, progress: resolveEasing(to.easing ?? easing)(localT) };
    }
  }
  // Unreachable given the sorted/bounds checks above, but fall back to the
  // last keyframe rather than throwing on a floating-point edge case.
  return { from: last, to: last, progress: 0 };
}

/**
 * Interpolates a numeric track at normalized time `t` - see class doc.
 * @param {{t:number, value:number}[]} keyframes
 * @param {number} t
 * @param {string|((t:number)=>number)} [easing]
 * @returns {number}
 */
export function interpolateNumber(keyframes, t, easing = 'linear') {
  const { from, to, progress } = locate(keyframes, t, easing);
  return from.value + (to.value - from.value) * progress;
}

function hexToRgb(hex) {
  const value = parseInt(hex.replace('#', ''), 16);
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff };
}

function rgbToHex({ r, g, b }) {
  const channel = (c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/**
 * Deterministic pseudo-noise offset for normalized time `t` - three sine
 * waves at non-harmonic frequency ratios (1x/2.13x/3.7x) and different
 * phases, summed and weighted so the result never looks like a single
 * clean oscillation. Used to give a scripted camera path a slightly
 * organic "handheld"/videogame-hazard wobble instead of a perfectly
 * mechanical sweep - deterministic (same `t`/config always produces the
 * same offset) so a recipe still renders identically every time, unlike
 * `Math.random()`.
 * @param {number} t normalized clip time, [0, 1]
 * @param {{amplitude?: number, frequency?: number, seed?: number}} [config]
 *   `frequency` is in cycles over the *whole* clip (t going 0 -> 1), not Hz.
 * @returns {number} an offset in [-amplitude, amplitude], 0 if amplitude is falsy
 */
export function wobble(t, { amplitude = 0, frequency = 1, seed = 0 } = {}) {
  if (!amplitude) return 0;
  const twoPi = Math.PI * 2;
  const a = Math.sin(twoPi * frequency * t + seed);
  const b = Math.sin(twoPi * frequency * 2.13 * t + seed * 1.7);
  const c = Math.sin(twoPi * frequency * 3.7 * t + seed * 2.9);
  return amplitude * (a * 0.6 + b * 0.3 + c * 0.1);
}

/**
 * Interpolates a hex-color track (e.g. "#ff2d55") at normalized time `t`,
 * channel-wise in RGB space - simple and predictable, matching how the rest
 * of the app already treats colors as plain hex strings (StrokePalette,
 * ColorPickerUI) rather than a perceptual color space.
 * @param {{t:number, value:string}[]} keyframes
 * @param {number} t
 * @param {string|((t:number)=>number)} [easing]
 * @returns {string}
 */
export function interpolateColor(keyframes, t, easing = 'linear') {
  const { from, to, progress } = locate(keyframes, t, easing);
  const a = hexToRgb(from.value);
  const b = hexToRgb(to.value);
  return rgbToHex({
    r: a.r + (b.r - a.r) * progress,
    g: a.g + (b.g - a.g) * progress,
    b: a.b + (b.b - a.b) * progress,
  });
}
