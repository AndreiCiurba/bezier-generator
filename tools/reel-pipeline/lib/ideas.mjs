// Starting-point recipes for a daily batch: a set of proven "archetypes"
// (an idea + an animated weave parameter + a hook line that go together),
// each filled in with seeded-random variation - palette, nail count, which
// way the camera turns, and which camera moves it strings together.
//
// These are drafts, not the finished batch. The daily agent is expected to
// look at stills of each, rework the weak ones and write new ideas of its
// own (see agents/daily-batch.md); this just guarantees a varied, renderable
// first pass every day and encodes what has worked so far.

/** Used only when no Color Hunt palettes have been fetched (see colorhunt.mjs) - normally those are the source. */
export const FALLBACK_PALETTES = {
  sunset: ['#ff2d95', '#ffd166', '#22d3ee'],
  ember: ['#ff4d00', '#ffb703', '#fff1c1'],
  ocean: ['#0057ff', '#00d4ff', '#e0fbff'],
  candy: ['#ff6b9d', '#c084fc', '#60a5fa'],
  aurora: ['#00ff9d', '#00b8ff', '#7a5cff'],
  rose: ['#bd5579', '#ea9d9d', '#ffebb8'],
};

const BACKGROUND = '#07070c';
const STUDIO_BACKGROUND = '#0b0b10'; // a touch lighter, for reels that show a real board
const PAINTED_BOARD = '#17171d';
const BARE_BOARD = '#b08a5a';
const NAIL_COLOR = '#d9d9e3';

// How long one string takes to place by hand - walk the thread to the nail,
// wrap it, pull it taut. The "this takes hours" reels turn string counts
// into hours with this; change it here if your own pace is different.
const SECONDS_PER_STRING_BY_HAND = 20;

const SOUNDS = [
  { scale: 'pentatonic', rootMidi: 57, bpm: 96 },
  { scale: 'lydian', rootMidi: 55, bpm: 104 },
  { scale: 'dorian', rootMidi: 52, bpm: 88 },
  { scale: 'hirajoshi', rootMidi: 57, bpm: 92 },
  { scale: 'minorPentatonic', rootMidi: 50, bpm: 100 },
  { scale: 'lydian', rootMidi: 53, bpm: 80 },
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function helpers(random) {
  const pick = (list) => list[Math.floor(random() * list.length)];
  const between = (min, max) => min + random() * (max - min);
  const whole = (min, max) => Math.round(between(min, max));
  const direction = () => (random() < 0.5 ? 1 : -1);
  return { pick, between, whole, direction };
}

const round = (value, places = 2) => Number(value.toFixed(places));

function brightness(hex) {
  const value = parseInt(hex.slice(1), 16);
  return 0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255);
}
const lightestFirst = (colors) => [...colors].sort((a, b) => brightness(b) - brightness(a));
const darkestFirst = (colors) => [...colors].sort((a, b) => brightness(a) - brightness(b));

/** The clip time (0..1) at which a rising, straight-line keyframe track reaches `value`. */
function timeAtValue(keyframes, value) {
  for (let i = 0; i + 1 < keyframes.length; i++) {
    const a = keyframes[i];
    const b = keyframes[i + 1];
    if (value >= a.value && value <= b.value && b.value > a.value) return a.t + ((value - a.value) / (b.value - a.value)) * (b.t - a.t);
  }
  return keyframes[keyframes.length - 1].t;
}

/**
 * The camera moves a hero shot is built from. Each takes the camera's state
 * at the start of a beat and returns where it should be by the end of it,
 * plus the easing of the move that gets it there. `base` is the framing the
 * whole piece fits in; `turn` (+1/-1) the way this reel orbits.
 */
const MOVES = {
  // Rush in close, a little lower. (`base.close` says how close this piece can take: a dense tower turns to haze from nearby.)
  pushIn: (s, { base, turn }) => ({ ...s, distance: base.distance * (base.close ?? 0.56), elevation: Math.max(8, base.elevation - 12), azimuth: s.azimuth + turn * 35, easing: 'easeOutExpo' }),
  // Back off wide and higher.
  pullOut: (s, { base, turn }) => ({ ...s, distance: base.distance * 1.14, elevation: Math.min(70, base.elevation + 16), azimuth: s.azimuth + turn * 55, easing: 'easeInOutCubic' }),
  // Whip half-way round the piece.
  whip: (s, { base, turn }) => ({ ...s, distance: base.distance * 0.9, azimuth: s.azimuth + turn * 170, easing: 'easeInOutExpo' }),
  // Swing down past side-on to look up at it from underneath.
  flipUnder: (s, { base, turn }) => ({ ...s, distance: base.distance * 0.95, elevation: -Math.max(22, base.elevation * 0.8), azimuth: s.azimuth + turn * 70, easing: 'easeInOutCubic' }),
  // Straight overhead, where the pattern reads as a drawing.
  overhead: (s, { base, turn }) => ({ ...s, distance: base.distance * 0.92, elevation: 89, azimuth: s.azimuth + turn * 45, easing: 'easeInOutCubic' }),
  // Punch in with the lens rather than the camera.
  zoom: (s, { turn }) => ({ ...s, fov: 26, azimuth: s.azimuth + turn * 25, easing: 'easeOutExpo' }),
  // A full barrel roll about the line of sight.
  roll: (s, { base, turn }) => ({ ...s, roll: s.roll + turn * 360, distance: base.distance * 0.8, azimuth: s.azimuth + turn * 40, easing: 'easeInOutCubic' }),
};

/**
 * Builds a camera for clip time `from`..`to` out of several distinct beats
 * (in, out, round, under, over, zoom, roll), never the same move twice
 * running, ending settled on the whole piece.
 * @param {object} h seeded helpers
 * @param {{
 *   from?:number, to?:number, beats?:number, turn:number,
 *   start:{azimuth:number, elevation:number, distance:number}, // where the camera is as this section begins
 *   base:{elevation:number, distance:number, close?:number},   // the framing that holds the whole piece; `close` = push-in distance as a share of it
 *   allow?:string[],                                           // which MOVES may be used
 *   targetY?:number,
 * }} options
 * @returns {object} a recipe `camera` section
 */
function choreograph(h, { from = 0, to = 1, beats = 4, turn, start, base, allow = Object.keys(MOVES), targetY = 0 }) {
  let state = { fov: 50, roll: 0, ...start };
  const keys = ['azimuth', 'elevation', 'distance', 'fov', 'roll'];
  const tracks = Object.fromEntries(keys.map((key) => [key, [{ t: round(from, 4), value: round(state[key]) }]]));
  let previous = null;
  for (let i = 0; i < beats; i++) {
    const t = round(from + ((to - from) * (i + 1)) / beats, 4);
    let next;
    if (i === beats - 1) {
      // Settle: the whole piece, level horizon, normal lens.
      next = { ...state, distance: base.distance, elevation: base.elevation, fov: 50, roll: Math.round(state.roll / 360) * 360, azimuth: state.azimuth + turn * 50, easing: 'easeInOutCubic' };
    } else {
      const name = h.pick(allow.filter((candidate) => candidate !== previous));
      previous = name;
      // A lens punch-in only lasts its own beat; every other move starts from a normal lens.
      next = MOVES[name]({ ...state, fov: 50 }, { base, turn });
    }
    const { easing, ...values } = next;
    for (const key of keys) tracks[key].push({ t, value: round(values[key]), easing });
    state = values;
  }
  return { ...Object.fromEntries(keys.map((key) => [key, { keyframes: tracks[key] }])), targetY };
}

/** Joins camera sections that follow one another in time (each a recipe `camera` object of keyframe tracks). */
function joinCameras(...sections) {
  const joined = {};
  for (const section of sections) {
    for (const [key, spec] of Object.entries(section)) {
      if (typeof spec === 'number') {
        joined[key] ??= spec;
        continue;
      }
      if (typeof joined[key] !== 'object') joined[key] = { keyframes: [] };
      joined[key].keyframes.push(...spec.keyframes);
    }
  }
  return joined;
}

/**
 * Each archetype returns the recipe body (everything but `meta`/sound, which
 * `buildIdeas` adds). `h` is the seeded helper set; `colors` the palette.
 */
const ARCHETYPES = {
  // One thread strings the board nail by nail. The camera works while it
  // does - in close on the thread, round, overhead to show the pattern - and
  // settles on the finished piece.
  'weave-reveal': (h, colors) => {
    const turn = h.direction();
    const start = h.between(0, 360);
    const done = 0.7;
    return {
      durationSeconds: 12,
      look: { background: STUDIO_BACKGROUND, board: PAINTED_BOARD, nailColor: NAIL_COLOR },
      weave: {
        nailCount: h.pick([72, 90, 108, 120]), layerCount: h.whole(3, 5), leap: h.whole(2, 5), multiplier: h.pick([2, 2, 3]),
        height: 900, weight: 0.55, nailThickness: 16, nailsVisible: true,
        drawProgress: { keyframes: [{ t: 0.02, value: 0.02 }, { t: done, value: 1 }], easing: 'easeInOutQuad' },
      },
      colors, colorMode: 'layer',
      camera: choreograph(h, {
        turn, beats: 5, targetY: 0.12,
        start: { azimuth: start, elevation: 24, distance: 2.7 },
        base: { elevation: 52, distance: 4.8, close: 0.66 },
        allow: ['pushIn', 'pullOut', 'whip', 'overhead'],
      }),
      edit: {
        captions: [
          { text: h.pick(['One thread.\n*Zero* curves.', 'Only *straight* lines.', 'Watch the curve\n*appear*']), start: 0, end: 3.2, position: 'top', size: 'xl' },
          { text: 'every line is straight', start: 4, end: 7.5, position: 'bottom', size: 'm', style: 'pill' },
          { text: h.pick(['The curve was never there.', 'Still no curves.']), start: 9, end: 12, position: 'bottom', size: 'm', style: 'pill' },
        ],
      },
    };
  },

  // Seen from straight above, a single layer steps through the times tables:
  // x2 is the cardioid, x3 the nephroid, and so on. Each number is held, then
  // morphs into the next - and on each morph the camera does something
  // different (punches in, spins, tips over to show it is a real object).
  'times-table': (h, colors) => {
    const last = h.whole(5, 8);
    const steps = last - 2;
    const hold = 0.55; // share of each step spent sitting on the whole number
    const keyframes = [];
    const captions = [];
    const duration = 3 + steps * 2;
    const names = { 2: 'cardioid', 3: 'nephroid' };
    const turn = h.direction();
    // The camera sits still on each whole number (so it can be read) and moves during the morph to the next.
    const camera = { azimuth: [{ t: 0, value: 90 }], elevation: [{ t: 0, value: 89 }], distance: [{ t: 0, value: 4.8 }], fov: [{ t: 0, value: 50 }] };
    let azimuth = 90;
    const poses = [
      { elevation: 89, distance: 3.1, fov: 50 }, // in close
      { elevation: 89, distance: 4.9, fov: 50 }, // back out
      { elevation: 38, distance: 4.6, fov: 50 }, // tipped over: it is an object, not a drawing
      { elevation: 89, distance: 4.6, fov: 30 }, // lens punch
      { elevation: 62, distance: 3.6, fov: 50 },
    ];
    for (let i = 0; i <= steps; i++) {
      const from = i / (steps + 1);
      const to = (i + hold) / (steps + 1);
      keyframes.push({ t: round(from, 4), value: i + 2 }, { t: round(to, 4), value: i + 2 });
      captions.push({
        text: `× *${i + 2}*${names[i + 2] ? `\n${names[i + 2]}` : ''}`,
        start: round(from * duration + (i === 0 ? 1.6 : 0)), end: round(to * duration + 0.35), position: 'bottom', size: 'l',
      });
      if (i > 0) {
        azimuth += turn * h.pick([60, 90, 180]);
        for (const [key, value] of Object.entries({ azimuth, ...poses[(i - 1) % poses.length] })) {
          const track = camera[key];
          track.push({ t: round((i - 1 + hold) / (steps + 1), 4), value: track[track.length - 1].value }, { t: round(from, 4), value, easing: 'easeInOutExpo' });
        }
      }
    }
    keyframes.push({ t: 1, value: last + 0.6 });
    for (const [key, value] of Object.entries({ azimuth: azimuth + turn * 40, elevation: 89, distance: 4.4, fov: 50 })) {
      const track = camera[key];
      track.push({ t: round((steps + hold) / (steps + 1), 4), value: track[track.length - 1].value }, { t: 1, value, easing: 'easeInOutCubic' });
    }
    return {
      durationSeconds: duration,
      look: { background: BACKGROUND, board: false, bloom: { strength: 0.18, radius: 0.35, threshold: 0.55 } },
      weave: { nailCount: h.pick([160, 200, 240]), layerCount: 1, leap: 0, height: 200, weight: 0.7, multiplier: { keyframes, easing: 'easeInOutCubic' } },
      colors, colorMode: 'arc',
      camera: Object.fromEntries(Object.entries(camera).map(([key, track]) => [key, { keyframes: track }])),
      edit: {
        captions: [
          { text: h.pick(['Same nails.\n*Different* number.', 'Multiplication,\nbut make it *art*', 'Your times tables\nlook like *this*']), start: 0, end: 1.6, position: 'top', size: 'xl' },
          ...captions,
        ],
      },
    };
  },

  // Opens as what looks like a flat drawing seen from above; then the camera
  // tips over and the layers lift apart into a tower, and the camera takes
  // off round it.
  'flat-to-3d': (h, colors) => {
    const turn = h.direction();
    const start = h.between(0, 360);
    const height = h.pick([3200, 4200]);
    const targetY = round(height / 3000 / 2);
    const standUp = {
      azimuth: { keyframes: [{ t: 0, value: round(start) }, { t: 0.25, value: round(start + turn * 20) }, { t: 0.55, value: round(start + turn * 110), easing: 'easeInOutCubic' }] },
      elevation: { keyframes: [{ t: 0, value: 89 }, { t: 0.22, value: 89 }, { t: 0.55, value: 16, easing: 'easeInOutCubic' }] },
      distance: { keyframes: [{ t: 0, value: 4.5 }, { t: 0.55, value: 5.2, easing: 'easeInOutCubic' }] },
      targetY: { keyframes: [{ t: 0, value: 0 }, { t: 0.25, value: 0 }, { t: 0.55, value: targetY, easing: 'easeInOutCubic' }] },
    };
    const { targetY: _, ...after } = choreograph(h, {
      from: 0.55, to: 1, beats: 3, turn,
      start: { azimuth: start + turn * 110, elevation: 16, distance: 5.2 },
      base: { elevation: 26, distance: 5, close: 0.74 },
      allow: ['pushIn', 'whip', 'flipUnder', 'roll', 'overhead'],
    });
    return {
      durationSeconds: 11,
      look: { background: BACKGROUND, board: false, bloom: { strength: 0.15, radius: 0.3, threshold: 0.6 } },
      weave: {
        nailCount: h.pick([96, 120, 144]), layerCount: h.whole(10, 16), leap: h.whole(2, 4), multiplier: h.pick([2, 3]), weight: 0.45,
        height: { keyframes: [{ t: 0, value: 40 }, { t: 0.25, value: 40 }, { t: 0.55, value: height }], easing: 'easeInOutCubic' },
      },
      colors, colorMode: 'layer',
      camera: joinCameras(standUp, after),
      edit: {
        captions: [
          { text: h.pick(['This is *not*\na flat drawing', 'Looks flat,\n*right?*', 'Wait for it\nto *stand up*']), start: 0, end: 2.6, position: 'top', size: 'xl' },
          { text: h.pick(['same pattern, stacked', 'layer by layer']), start: 5.5, end: 9.5, position: 'bottom', size: 'm', style: 'pill' },
        ],
      },
    };
  },

  // A tall stack whose layers start out identical; then each layer turns a
  // little further than the one below (the leap grows) and the tower twists.
  'tower-twist': (h, colors) => {
    const turn = h.direction();
    const start = h.between(0, 360);
    const twist = h.pick([3, 4, 6]);
    return {
      durationSeconds: 11,
      look: { background: BACKGROUND, board: false },
      weave: {
        nailCount: h.pick([60, 72, 96]), layerCount: h.whole(18, 28), multiplier: h.pick([2, 3, 4]), height: 4200, weight: 0.4,
        leap: { keyframes: [{ t: 0, value: 0 }, { t: 0.15, value: 0 }, { t: 0.6, value: twist }, { t: 0.8, value: twist }, { t: 1, value: twist * 0.5 }], easing: 'easeInOutCubic' },
      },
      colors, colorMode: 'layer',
      camera: choreograph(h, {
        turn, beats: 4, targetY: 0.62,
        start: { azimuth: start, elevation: 34, distance: 5.2 },
        base: { elevation: 30, distance: 5.1, close: 0.74 },
        allow: ['pushIn', 'pullOut', 'whip', 'flipUnder', 'overhead', 'roll'],
      }),
      edit: {
        captions: [
          { text: h.pick(['Change *one*\nnumber', 'One number.\nWatch the *twist*.']), start: 0, end: 2.4, position: 'top', size: 'xl' },
          { text: 'each layer turns a little more', start: 3.2, end: 7, position: 'bottom', size: 'm', style: 'pill' },
        ],
      },
    };
  },

  // Drops straight down the axis of the finished piece into the middle of
  // it, turns the camera a full quarter-turn up to look out horizontally
  // through the strings, looks round, then backs out through the side wall
  // to a view of the whole tower. (Once the camera has reached its own
  // target, changing `elevation` no longer moves it - it turns it on the
  // spot - which is what makes the quarter-turn a turn.) Kept deliberately spare - few layers, each
  // turned by a single nail, fine strings, the lightest color at the bottom
  // so the inside glows - because a dive through a dense piece is a tangle.
  dive: (h, colors) => {
    const turn = h.direction();
    const nailCount = h.pick([60, 72, 84]);
    const layerCount = h.whole(10, 14);
    const height = 2400;
    const middle = round(height / 3000 / 2); // the camera's target: the middle of the stack, on its axis
    return {
      durationSeconds: 14,
      look: { background: '#0a080d', board: false, bloom: { strength: 0.12, radius: 0.5, threshold: 0.5 } },
      weave: { nailCount, layerCount, leap: 1, multiplier: 2, height, weight: 0.32 },
      colors: lightestFirst(colors), colorMode: 'layer',
      camera: {
        targetY: middle,
        // Overhead and still; then down the axis until the camera is at the target itself; later, straight back out.
        distance: { keyframes: [{ t: 0, value: 4.4 }, { t: 0.1, value: 4.4 }, { t: 0.36, value: 0.04, easing: 'easeInOutCubic' }, { t: 0.74, value: 0.04 }, { t: 1, value: 4.7, easing: 'easeInOutCubic' }] },
        // Looking straight down for the dive, then the quarter-turn to level.
        elevation: { keyframes: [{ t: 0, value: 89 }, { t: 0.36, value: 89 }, { t: 0.5, value: 2, easing: 'easeInOutCubic' }, { t: 0.74, value: 2 }, { t: 1, value: 20, easing: 'easeInOutCubic' }] },
        // With the camera on the axis looking out, turning the azimuth is looking round inside.
        azimuth: { keyframes: [{ t: 0, value: 90 }, { t: 0.36, value: 90 + turn * 40 }, { t: 0.5, value: 90 + turn * 60 }, { t: 0.74, value: 90 + turn * 250, easing: 'easeInOutCubic' }, { t: 1, value: 90 + turn * 280 }] },
        fov: { keyframes: [{ t: 0.1, value: 50 }, { t: 0.36, value: 70, easing: 'easeInOutCubic' }, { t: 0.74, value: 70 }, { t: 1, value: 50, easing: 'easeInOutCubic' }] },
      },
      edit: {
        captions: [
          { text: h.pick(['Only *straight* lines', 'Not one\n*curved* line']), start: 0, end: 2.4, position: 'top', size: 'l' },
          { text: 'step inside', start: 3.2, end: 5.6, position: 'bottom', size: 'm', style: 'pill' },
          { text: 'look around', start: 6.6, end: 9.6, position: 'bottom', size: 'm', style: 'pill' },
        ],
      },
      post: { caption: `${nailCount} nails, ${layerCount} layers, and not one curved line. Each layer is the same cardioid, turned by a single nail.` },
    };
  },

  // The whole weave is strung at once (every layer together) while the
  // palette shifts and the camera keeps finding a new angle on it.
  bloom: (h, colors, palettes) => {
    const turn = h.direction();
    const start = h.between(0, 360);
    const other = h.pick(palettes.filter((p) => p !== colors && p.length === colors.length));
    const shifting = colors.map((color, i) => ({ keyframes: [{ t: 0.45, color }, { t: 0.9, color: other?.[i] ?? color }] }));
    return {
      durationSeconds: 10,
      look: { background: BACKGROUND, board: false, bloom: { strength: 0.18, radius: 0.35, threshold: 0.55 } },
      weave: {
        nailCount: h.pick([120, 150, 180]), layerCount: h.whole(6, 10), leap: h.whole(3, 7), multiplier: h.pick([2, 3, 4, 5]), height: 1500, weight: 0.5,
        drawMode: 'parallel',
        drawProgress: { keyframes: [{ t: 0, value: 0.1 }, { t: 0.5, value: 1 }], easing: 'easeInOutQuad' },
      },
      colors: shifting, colorMode: 'layer',
      camera: choreograph(h, {
        turn, beats: 4, targetY: 0.2,
        start: { azimuth: start, elevation: 72, distance: 4.9 },
        base: { elevation: 40, distance: 4.8 },
        allow: ['pushIn', 'pullOut', 'whip', 'flipUnder', 'overhead', 'roll', 'zoom'],
      }),
      edit: {
        captions: [
          { text: h.pick(['Oddly\n*satisfying*', 'Math is\n*beautiful*', 'Turn the\n*sound on*']), start: 0, end: 2.6, position: 'top', size: 'xl' },
        ],
      },
    };
  },

  // As many layers as nails, each turned one nail from the one below, so the
  // stack makes exactly one full turn from bottom to top - the Cardioid
  // board's own signature look. Every layer grows at once.
  'full-turn': (h, colors) => {
    const turn = h.direction();
    const start = h.between(0, 360);
    const count = h.pick([36, 48, 60]);
    const height = h.pick([3600, 4200, 4800]);
    return {
      durationSeconds: 12,
      look: { background: BACKGROUND, board: false, bloom: { strength: 0.12, radius: 0.4, threshold: 0.55 } },
      weave: {
        nailCount: count, layerCount: count, leap: 1, multiplier: h.pick([2, 2, 3]), height, weight: count >= 60 ? 0.22 : 0.28, drawMode: 'parallel',
        drawProgress: { keyframes: [{ t: 0, value: 0.25 }, { t: 0.5, value: 1 }], easing: 'easeInOutQuad' },
      },
      colors: darkestFirst(colors), colorMode: 'layer',
      camera: choreograph(h, {
        turn, beats: 5, targetY: round(height / 3000 / 2),
        start: { azimuth: start, elevation: 58, distance: 5.6 },
        base: { elevation: 24, distance: 5.4, close: 0.76 },
        allow: ['pushIn', 'pullOut', 'whip', 'flipUnder', 'overhead', 'roll'],
      }),
      edit: {
        captions: [
          { text: `*${count}* nails.\n*${count}* layers.`, start: 0, end: 2.8, position: 'top', size: 'xl' },
          { text: 'each layer turned by one nail', start: 4, end: 8, position: 'bottom', size: 'm', style: 'pill' },
        ],
      },
      post: { caption: `${count} nails and ${count} layers. Every layer is the same pattern turned by one nail, so the stack makes exactly one full turn.` },
    };
  },

  // The patient one: a real board, strings going on one at a time - the first
  // few slowly enough to follow each across - then faster and faster up
  // through forty layers, with an hour counter for what this would take by
  // hand. The camera starts on the first nail and gets busier as the pace does.
  hours: (h, colors) => {
    const turn = h.direction();
    const nailCount = h.pick([40, 48, 56]);
    const layerCount = h.pick([36, 40, 44]);
    const strings = layerCount * (nailCount - 1);
    const hours = Math.max(2, Math.round((strings * SECONDS_PER_STRING_BY_HAND) / 3600));
    const duration = 16;
    const firstFew = 8.5 / strings; // the strings shown one by one before the pace picks up
    const progress = [
      { t: 0, value: 0 }, { t: 0.22, value: round(firstFew, 5) }, { t: 0.4, value: 0.014 }, { t: 0.58, value: 0.07 },
      { t: 0.74, value: 0.27 }, { t: 0.88, value: 0.65 }, { t: 0.96, value: 1 },
    ];
    const marks = [...new Set([1, Math.round(hours * 0.3), Math.round(hours * 0.6), hours])].filter((mark) => mark >= 1);
    const counter = marks.map((mark, i) => {
      const at = timeAtValue(progress, mark / hours) * duration;
      const next = i + 1 < marks.length ? timeAtValue(progress, marks[i + 1] / hours) * duration : duration;
      return { text: `hour *${mark}*`, start: round(at), end: round(Math.min(next, at + 2.4)), position: 'bottom', size: 'l' };
    });
    // Opens over the first nail (the top of the circle, azimuth -90), where the first strings go on.
    const opening = {
      azimuth: { keyframes: [{ t: 0, value: -90 + turn * 14 }, { t: 0.4, value: -90 + turn * 40, easing: 'easeInOutQuad' }] },
      elevation: { keyframes: [{ t: 0, value: 46 }, { t: 0.4, value: 36, easing: 'easeInOutQuad' }] },
      distance: { keyframes: [{ t: 0, value: 1.5 }, { t: 0.3, value: 2.2, easing: 'easeInOutQuad' }, { t: 0.4, value: 2.8, easing: 'easeInOutQuad' }] },
      targetZ: { keyframes: [{ t: 0, value: -0.82 }, { t: 0.3, value: -0.6, easing: 'easeInOutQuad' }, { t: 0.55, value: 0, easing: 'easeInOutQuad' }] },
      targetY: { keyframes: [{ t: 0, value: 0.02 }, { t: 0.5, value: 0.1, easing: 'easeInOutQuad' }, { t: 1, value: 0.42, easing: 'easeInOutQuad' }] },
    };
    const { targetY: _, ...after } = choreograph(h, {
      from: 0.4, to: 1, beats: 4, turn,
      start: { azimuth: -90 + turn * 40, elevation: 36, distance: 2.8 },
      base: { elevation: 30, distance: 5.2 },
      allow: ['pullOut', 'whip', 'overhead', 'pushIn', 'zoom'],
    });
    return {
      durationSeconds: duration,
      look: { background: STUDIO_BACKGROUND, board: PAINTED_BOARD, nailColor: NAIL_COLOR },
      weave: {
        nailCount, layerCount, leap: 1, multiplier: 2, height: 2600, nailThickness: 30, nailsVisible: true,
        // Bold while there are only a few strings to look at, fine once there are hundreds.
        weight: { keyframes: [{ t: 0.22, value: 1.3 }, { t: 0.6, value: 0.45 }], easing: 'easeInOutQuad' },
        drawProgress: { keyframes: progress },
      },
      colors: darkestFirst(colors), // the finished piece is seen from above, so the lightest color goes on last
      colorMode: 'layer',
      camera: joinCameras(opening, after),
      edit: {
        captions: [
          { text: `By hand, this takes\n*${hours} hours*`, start: 0, end: 3, position: 'top', size: 'l' },
          ...counter,
        ],
      },
      post: {
        caption: `${strings.toLocaleString('en-US')} strings over ${nailCount} nails and ${layerCount} layers. Strung by hand at about ${SECONDS_PER_STRING_BY_HAND} seconds a string, that is roughly ${hours} hours of work.`,
      },
    };
  },

  // From nothing: a bare wooden board is sprayed, the nails are hammered in
  // round the circle (the first few blow by blow, then at speed), and the
  // thread goes on - its first strings slow, bold and seen from above with
  // the whole board in frame, so the moment the weaving starts is unmissable.
  'making-of': (h, colors) => {
    const turn = h.direction();
    const nailCount = h.pick([48, 60, 72]);
    const layerCount = h.whole(6, 10);
    const strings = layerCount * (nailCount - 1);
    const setup = {
      // Nail 0, where the hammering begins, is at azimuth -90. One close look at the first blows, then back off to see the whole ring fill in.
      azimuth: { keyframes: [{ t: 0, value: -130 }, { t: 0.16, value: -78, easing: 'easeInOutCubic' }, { t: 0.25, value: -70 }, { t: 0.4, value: 60, easing: 'easeInOutCubic' }, { t: 0.46, value: 90, easing: 'easeInOutCubic' }, { t: 0.62, value: 96 }] },
      elevation: { keyframes: [{ t: 0, value: 52 }, { t: 0.16, value: 28, easing: 'easeInOutCubic' }, { t: 0.25, value: 26 }, { t: 0.33, value: 50, easing: 'easeOutExpo' }, { t: 0.4, value: 54 }, { t: 0.46, value: 80, easing: 'easeInOutCubic' }, { t: 0.62, value: 74, easing: 'easeInOutQuad' }] },
      distance: { keyframes: [{ t: 0, value: 5.6 }, { t: 0.16, value: 3.6, easing: 'easeInOutCubic' }, { t: 0.25, value: 3.6 }, { t: 0.33, value: 5.0, easing: 'easeOutExpo' }, { t: 0.4, value: 5.0 }, { t: 0.46, value: 4.7, easing: 'easeInOutCubic' }, { t: 0.62, value: 4.5, easing: 'easeInOutQuad' }] },
    };
    const { targetY: _, ...after } = choreograph(h, {
      from: 0.62, to: 1, beats: 4, turn,
      start: { azimuth: 96, elevation: 74, distance: 4.5 },
      base: { elevation: 56, distance: 4.9 },
      allow: ['pushIn', 'pullOut', 'whip', 'overhead', 'zoom'],
    });
    return {
      durationSeconds: 22,
      look: { background: STUDIO_BACKGROUND, board: BARE_BOARD, nailColor: NAIL_COLOR },
      making: {
        paintColor: PAINTED_BOARD,
        canColor: colors[Math.min(1, colors.length - 1)],
        paint: { keyframes: [{ t: 0.03, value: 0 }, { t: 0.15, value: 1 }] },
        nails: { keyframes: [{ t: 0.16, value: 0 }, { t: 0.25, value: round(3 / nailCount, 4) }, { t: 0.4, value: 1 }], easing: 'easeInCubic' },
      },
      weave: {
        nailCount, layerCount, leap: h.whole(2, 4), multiplier: 2, height: 800, nailThickness: 40, nailsVisible: true,
        // The first strings are drawn very bold, so the start of the weaving cannot be missed.
        weight: { keyframes: [{ t: 0.6, value: 1.9 }, { t: 0.8, value: 0.6 }], easing: 'easeInOutQuad' },
        // Overhead by now: about a dozen strings one at a time, then faster and faster.
        drawProgress: { keyframes: [{ t: 0.46, value: 0 }, { t: 0.62, value: round(12 / strings, 5) }, { t: 0.94, value: 1, easing: 'easeInCubic' }] },
      },
      colors: lightestFirst(colors), colorMode: 'layer',
      camera: { ...joinCameras(setup, after), targetY: 0.08 },
      edit: {
        captions: [
          { text: 'It starts with\n*a bare board*', start: 0, end: 2.4, position: 'top', size: 'xl' },
          { text: 'paint', start: 1, end: 3.2, position: 'bottom', size: 'm', style: 'pill' },
          { text: `${nailCount} nails`, start: 4, end: 8.6, position: 'bottom', size: 'm', style: 'pill' },
          { text: 'Now the\n*thread*', start: 9.6, end: 12.6, position: 'top', size: 'xl' },
          { text: 'one straight string at a time', start: 10.4, end: 13.6, position: 'bottom', size: 'm', style: 'pill' },
          { text: `*${strings.toLocaleString('en-US')}* strings later`, start: 18, end: 21.2, position: 'top', size: 'l' },
        ],
      },
      post: { caption: `A bare board, a coat of paint, ${nailCount} nails and one thread: ${strings.toLocaleString('en-US')} straight strings, and a curve that was never drawn.` },
    };
  },

  // The explainer: how straight strings make a curve. Few nails, seen from
  // above; one string at a time is picked out in white while a caption says
  // which nail it joins to which ("nail 3 to nail 6"), then the rule is left
  // to run, and the camera drops off the overhead view to show the result
  // as an object.
  explainer: (h, colors) => {
    const turn = h.direction();
    const nailCount = h.pick([30, 36, 40]);
    const layerCount = h.whole(4, 6);
    const shown = 5; // strings walked through one by one
    const duration = 15;
    const stepStart = 0.1;
    const stepEnd = 0.5;
    const perLayer = nailCount - 1;
    const chord = [{ t: 0, value: 0 }];
    const drawn = [{ t: 0, value: 0 }];
    const captions = [];
    for (let j = 1; j <= shown; j++) {
      const from = stepStart + ((j - 1) * (stepEnd - stepStart)) / shown;
      const to = stepStart + (j * (stepEnd - stepStart)) / shown;
      const arrive = from + (to - from) * 0.3;
      chord.push({ t: round(from, 4), value: j === 1 ? 1 : j - 1 }, { t: round(arrive, 4), value: j, easing: 'easeInOutCubic' });
      drawn.push({ t: round(from, 4), value: round((j - 1) / (perLayer * layerCount), 5) }, { t: round(arrive, 4), value: round(j / (perLayer * layerCount), 5) });
      captions.push({ text: `nail *${j}* → nail *${j * 2}*`, start: round(from * duration), end: round(to * duration), position: 'bottom', size: 'l' });
    }
    chord.push({ t: stepEnd, value: shown }, { t: round(stepEnd + 0.01, 4), value: 0 });
    drawn.push({ t: stepEnd, value: round(shown / (perLayer * layerCount), 5) }, { t: 0.74, value: 1, easing: 'easeInCubic' });
    const overhead = {
      azimuth: { keyframes: [{ t: 0, value: 90 }, { t: stepEnd, value: 90 }] },
      elevation: { keyframes: [{ t: 0, value: 89 }, { t: stepEnd, value: 89 }] },
      // In on the nails being talked about (they start at the top of the circle and run clockwise), then back out.
      distance: { keyframes: [{ t: 0, value: 4.6 }, { t: stepStart, value: 3.0, easing: 'easeOutExpo' }, { t: stepEnd, value: 3.4 }] },
      targetX: { keyframes: [{ t: 0, value: 0 }, { t: stepStart, value: 0.42, easing: 'easeOutExpo' }, { t: stepEnd, value: 0.3 }, { t: 0.62, value: 0, easing: 'easeInOutCubic' }] },
      targetZ: { keyframes: [{ t: 0, value: 0 }, { t: stepStart, value: -0.42, easing: 'easeOutExpo' }, { t: stepEnd, value: -0.2 }, { t: 0.62, value: 0, easing: 'easeInOutCubic' }] },
    };
    const { targetY: _, ...after } = choreograph(h, {
      from: stepEnd, to: 1, beats: 4, turn,
      start: { azimuth: 90, elevation: 89, distance: 3.4 },
      base: { elevation: 50, distance: 4.9 },
      allow: ['pullOut', 'pushIn', 'whip', 'zoom'],
    });
    return {
      durationSeconds: duration,
      look: { background: STUDIO_BACKGROUND, board: PAINTED_BOARD, nailColor: NAIL_COLOR },
      explain: { chord: { keyframes: chord }, color: '#ffffff', weight: 2.4 },
      weave: {
        nailCount, layerCount, leap: h.whole(1, 2), multiplier: 2, height: 700, nailThickness: 44, nailsVisible: true,
        weight: { keyframes: [{ t: stepEnd, value: 1.1 }, { t: 0.74, value: 0.6 }], easing: 'easeInOutQuad' },
        drawProgress: { keyframes: drawn },
      },
      colors: lightestFirst(colors), colorMode: 'layer',
      camera: { ...joinCameras(overhead, after), targetY: 0.08 },
      edit: {
        captions: [
          { text: 'How does string\nmake a *curve*?', start: 0, end: 1.5, position: 'top', size: 'xl' },
          ...captions,
          { text: 'every nail goes to *double* its number', start: round(stepEnd * duration + 0.2), end: round(0.74 * duration), position: 'top', size: 'l' },
          { text: 'no curved line anywhere', start: round(0.8 * duration), end: duration - 0.6, position: 'bottom', size: 'm', style: 'pill' },
        ],
      },
      post: { caption: `The whole rule: join every nail to the nail with double its number. ${nailCount} nails, ${layerCount} layers, only straight strings - the heart shape is just where they cross.` },
    };
  },
};

export const ARCHETYPE_NAMES = Object.keys(ARCHETYPES);

/**
 * @param {{count:number, seed:number, weights?:Record<string, number>, palettes?:Record<string, string[]>}} options
 *   `weights` biases how often each archetype comes up (see feedback.mjs#archetypeWeights);
 *   left out, the archetypes simply take turns. `palettes` is `{ name: colors }` -
 *   normally the saved Color Hunt palettes.
 * @returns {{id:string, recipe:object}[]}
 */
export function buildIdeas({ count, seed, weights = null, palettes = FALLBACK_PALETTES }) {
  const random = mulberry32(seed);
  const h = helpers(random);
  const paletteNames = Object.keys(palettes);
  const paletteList = Object.values(palettes);

  const chooseArchetype = (index) => {
    if (!weights) return ARCHETYPE_NAMES[index % ARCHETYPE_NAMES.length];
    const total = ARCHETYPE_NAMES.reduce((sum, name) => sum + (weights[name] ?? 1), 0);
    let roll = random() * total;
    for (const name of ARCHETYPE_NAMES) {
      const weight = weights[name] ?? 1;
      if (weight <= 0) continue;
      roll -= weight;
      if (roll <= 0) return name;
    }
    return ARCHETYPE_NAMES.find((name) => (weights[name] ?? 1) > 0);
  };

  const ideas = [];
  for (let i = 0; i < count; i++) {
    const archetype = chooseArchetype(i);
    const paletteName = h.pick(paletteNames);
    const { post = {}, ...body } = ARCHETYPES[archetype](h, palettes[paletteName], paletteList);
    const id = String(i + 1).padStart(2, '0');
    body.edit.audio = { synth: { ...h.pick(SOUNDS), seed: seed + i, brightness: round(h.between(0.35, 0.75)) } };
    ideas.push({
      id,
      recipe: {
        scene: 'cardioid',
        meta: { id, archetype, palette: paletteName, title: `${archetype} / ${paletteName}` },
        ...body,
        post: {
          caption: 'Every line here is straight. The curve is only where they cross.',
          hashtags: ['#stringart', '#mathart', '#satisfying', '#geometry', '#generativeart'],
          ...post,
        },
      },
    });
  }
  return ideas;
}
