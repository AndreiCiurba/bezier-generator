import { interpolateNumber, interpolateColor, wobble } from './keyframe.js';

/**
 * The reel pipeline's shared timeline vocabulary - number/color tracks and
 * the spherical "orbit" camera - used by every scene's pure frame resolver
 * (`cardioid/cardioidReelFrame.js`, `arrange/arrangeReelFrame.js`,
 * `three-page/gridReelFrame.js`). No Three.js/DOM dependency.
 *
 * A track is `{ keyframes: [{ t, value, easing? }], easing, wobble }` with
 * `t` normalized to the clip (0..1); `{ value, wobble }` is a constant with
 * handheld-style drift; a plain number is a constant.
 */

export const REEL_CAMERA_DEFAULTS = {
  azimuth: 90,
  elevation: 55,
  distance: 4.6,
  targetX: 0,
  targetY: 0,
  targetZ: 0,
  fov: 50,
  roll: 0,
  tilt: 0,
};

// Straight down is degenerate for a look-at camera (no way to tell which way
// is "up" on screen), so top-down shots stop a hair short of it.
const MAX_ELEVATION = 89.5;

/**
 * One number-or-track value at clip time `t`.
 * @param {number|{keyframes?:{t:number,value:number}[], value?:number, easing?:string, wobble?:object}|undefined} spec
 * @param {number} t
 * @param {number} fallback used when the recipe leaves the value out
 * @returns {number}
 */
export function resolveTrack(spec, t, fallback) {
  if (spec === undefined || spec === null) return fallback;
  if (typeof spec === 'number') return spec;
  const base = spec.keyframes ? interpolateNumber(spec.keyframes, t, spec.easing) : spec.value ?? fallback;
  return base + wobble(t, spec.wobble);
}

/** A plain hex string, or a `{ keyframes: [{ t, color }], easing }` track. */
export function resolveColor(spec, t) {
  if (typeof spec === 'string') return spec;
  return interpolateColor(spec.keyframes.map((k) => ({ t: k.t, value: k.color })), t, spec.easing);
}

/**
 * Evenly spaced colors through `colors` - first color at index 0, last at `count - 1`.
 * @param {string[]} colors
 * @param {number} count
 * @returns {string[]}
 */
export function colorGradient(colors, count) {
  if (colors.length === 1) return Array.from({ length: count }, () => colors[0]);
  const stops = colors.map((color, i) => ({ t: i / (colors.length - 1), value: color }));
  return Array.from({ length: count }, (_, i) => interpolateColor(stops, count === 1 ? 0 : i / (count - 1)));
}

/**
 * `count` layers in solid bands, one band per color, bottom band first - 40
 * layers of a 4-color palette are 10 of each. Unlike `colorGradient`, every
 * layer is one of the palette's own colors.
 */
export function colorBands(colors, count) {
  return Array.from({ length: count }, (_, i) => colors[Math.min(colors.length - 1, Math.floor((i * colors.length) / count))]);
}

/** The color at fraction `f` (0..1) of the way through `colors`. */
export function colorAt(colors, f) {
  if (colors.length === 1) return colors[0];
  const stops = colors.map((color, i) => ({ t: i / (colors.length - 1), value: color }));
  return interpolateColor(stops, Math.min(1, Math.max(0, f)));
}

/**
 * The orbit camera at clip time `t`: `azimuth` (degrees round the piece),
 * `elevation` (degrees above the board plane: 0 = side-on, 90 = straight
 * down), `distance`, `targetX`/`targetY`/`targetZ` (the point looked at; Y is
 * up), `fov`, `roll` and `tilt` (degrees; tilt pitches the view up without
 * moving the camera) - each a number or a track. Distances and target
 * offsets are multiples of `unit`, so a recipe frames the same whatever size
 * the piece is in world units.
 *
 * With `fly` set, the camera is a drone instead - see `resolveFlyCamera`.
 *
 * With `shots` set, the clip is cut together from several cameras: each shot
 * is a whole camera of its own (orbit or `fly`) plus `from`, the clip time it
 * cuts in at, and runs until the next shot's `from`. Its tracks are in clip
 * time like everything else. Fields set beside `shots` are every shot's
 * defaults. See `cameraShotAt`.
 * @param {object|undefined} cam
 * @param {number} t
 * @param {number} unit
 * @param {(p:{x:number,y:number,h:number}) => {x:number,y:number,z:number}} [place] board point to world (fly mode only)
 * @returns {{position:{x:number,y:number,z:number}, target:{x:number,y:number,z:number}, fov:number, roll:number, tilt:number}}
 */
export function resolveOrbitCamera(cam = {}, t, unit, place) {
  if (cam.shots?.length) {
    const { shot, from, to } = cameraShotAt(cam, t);
    return shot.fly ? resolveFlyCamera(shot, t, unit, place, [from, to]) : resolveOrbitCamera(shot, t, unit, place);
  }
  if (cam.fly) return resolveFlyCamera(cam, t, unit, place);
  const value = (key) => resolveTrack(cam[key], t, REEL_CAMERA_DEFAULTS[key]);
  const azimuth = (value('azimuth') * Math.PI) / 180;
  const elevation = (Math.min(MAX_ELEVATION, Math.max(-MAX_ELEVATION, value('elevation'))) * Math.PI) / 180;
  const distance = value('distance') * unit;
  const target = { x: value('targetX') * unit, y: value('targetY') * unit, z: value('targetZ') * unit };
  return {
    position: {
      x: target.x + distance * Math.cos(elevation) * Math.cos(azimuth),
      y: target.y + distance * Math.sin(elevation),
      z: target.z + distance * Math.cos(elevation) * Math.sin(azimuth),
    },
    target,
    fov: value('fov'),
    roll: value('roll'),
    tilt: value('tilt'),
  };
}

/**
 * The shot of a cut-together camera (`cam.shots`) at clip time `t`: the
 * shot's own camera (with the fields set beside `shots` as defaults), and the
 * stretch `[from, to]` of the clip it runs for. A camera without shots is one
 * shot covering the whole clip.
 * @returns {{shot: object, from: number, to: number, index: number}}
 */
export function cameraShotAt(cam = {}, t) {
  if (!cam.shots?.length) return { shot: cam, from: 0, to: 1, index: 0 };
  const { shots, ...defaults } = cam;
  const ordered = shots.map((shot, i) => ({ shot, i, from: shot.from ?? 0 })).sort((a, b) => a.from - b.from || a.i - b.i);
  let k = 0;
  while (k + 1 < ordered.length && ordered[k + 1].from <= t) k++;
  const { shot, i, from } = ordered[k];
  const to = k + 1 < ordered.length ? ordered[k + 1].from : 1;
  return { shot: { ...defaults, ...shot }, from: Math.max(0, from), to, index: i };
}

/** The clip times a cut-together camera cuts from one shot to the next. */
export function cameraCuts(cam = {}) {
  if (!cam.shots?.length) return [];
  return [...new Set(cam.shots.map((shot) => shot.from ?? 0))].filter((from) => from > 0 && from < 1).sort((a, b) => a - b);
}

/** How far through its own window [start, end] of an overall 0..1 progress something is. */
export function windowProgress(progress, start = 0, end = 1) {
  if (end <= start) return progress >= end ? 1 : 0;
  return Math.min(1, Math.max(0, (progress - start) / (end - start)));
}

// Board point (x, y across the board, h up off it) to world, for a board lying flat.
const FLAT = (p) => ({ x: p.x, y: p.h, z: p.y });

/**
 * A point on the smooth curve through `points` (each `{ t, x, y, h }`) at
 * clip time `t`: a monotone cubic per coordinate (Steffen's method), so the
 * speed changes smoothly across waypoints however unevenly they are spaced
 * in time, and the camera never overshoots a waypoint and backs up to it -
 * a hover followed by a fast dive used to bounce with the Catmull-Rom curve
 * this replaced. Held at the ends outside the first and last waypoints.
 */
export function flyPathPoint(points, t) {
  const n = points.length;
  if (n === 1 || t <= points[0].t) return { x: points[0].x, y: points[0].y, h: points[0].h };
  if (t >= points[n - 1].t) return { x: points[n - 1].x, y: points[n - 1].y, h: points[n - 1].h };
  let i = 0;
  while (points[i + 1].t < t) i++;
  const span = (k) => points[k + 1].t - points[k].t;
  const slope = (k, key) => (span(k) > 0 ? (points[k + 1][key] - points[k][key]) / span(k) : 0);
  // Steffen: the waypoint's slope never exceeds what keeps the curve between its neighbours.
  const tangent = (k, key) => {
    if (k === 0) return slope(0, key);
    if (k === n - 1) return slope(n - 2, key);
    const before = slope(k - 1, key);
    const after = slope(k, key);
    if (before * after <= 0) return 0;
    const mean = (before * span(k) + after * span(k - 1)) / (span(k - 1) + span(k) || 1);
    return Math.sign(before) * Math.min(Math.abs(before), Math.abs(after), 0.5 * Math.abs(mean)) * 2;
  };
  const dt = span(i);
  const u = dt > 0 ? (t - points[i].t) / dt : 0;
  const h00 = 2 * u ** 3 - 3 * u ** 2 + 1;
  const h10 = u ** 3 - 2 * u ** 2 + u;
  const h01 = -2 * u ** 3 + 3 * u ** 2;
  const h11 = u ** 3 - u ** 2;
  const value = (key) => h00 * points[i][key] + h10 * dt * tangent(i, key) + h01 * points[i + 1][key] + h11 * dt * tangent(i + 1, key);
  return { x: value('x'), y: value('y'), h: value('h') };
}

/**
 * The drone camera: `fly.path` is a list of waypoints `{ t, x, y, h }` in
 * board coordinates (x, y across the board, h up off it; multiples of
 * `unit`, like the orbit camera's distances) and the camera glides through
 * them on a smooth curve - low between the nails, under raised strings,
 * up and over. It faces where it is going (`fly.look` `"ahead"`, the
 * default) or keeps turned to a board point (`fly.look: { x, y, h, blend }`,
 * each a number or track; `blend` 0..1 eases between facing ahead (0) and
 * facing the point (1, the default) - so a shot can start on the piece, dive
 * and fly, then turn back to it for the last frame), and leans into turns like a drone by `fly.bank`
 * (0 = level, 1 = about 30 degrees in a tight turn; default 0.4). It flies
 * with the board as its ground (`fly.horizon`, see `flyUp`), so on a
 * wall-hung piece the picture stays the right way up relative to the board. `fov`,
 * `tilt` (pitch up/down from the heading) and `roll` are the usual tracks.
 * `place` maps a board point to world (the board flat by default; wall-hung
 * pieces pass their mount). `range` is the stretch of the clip this camera
 * is on screen for (one shot of a cut-together camera): the steadicam and
 * the heading only look within it, so nothing of the next shot leaks in
 * before the cut.
 */
export function resolveFlyCamera(cam, t, unit, place = FLAT, range = [0, 1]) {
  const { path = [], look = 'ahead', bank = 0.4 } = cam.fly;
  const points = path.map((p) => ({ t: p.t, x: p.x ?? 0, y: p.y ?? 0, h: p.h ?? 0 })).sort((a, b) => a.t - b.t);
  if (points.length === 0) points.push({ t: 0, x: 0, y: 0, h: 1 });
  const world = (p) => {
    const w = place(p);
    return { x: w.x * unit, y: w.y * unit, z: w.z * unit };
  };
  const [from, to] = range;
  const clamp01 = (time) => Math.min(to, Math.max(from, Math.min(1, Math.max(0, time))));
  const at = (time) => flyPathPoint(points, clamp01(time));
  // Which way the path runs at `time`, on the board: a fixed window clamped to
  // the clip, so it changes smoothly right to the last frame (a window that
  // grew in steps near the ends made the camera judder there).
  const heading = (time) => {
    const t0 = clamp01(time);
    const a = at(t0 - 0.01);
    const b = at(t0 + 0.01);
    const v = { x: b.x - a.x, y: b.y - a.y, h: b.h - a.h };
    if (Math.hypot(v.x, v.y, v.h) > 1e-9) return v;
    const first = points[0];
    const last = points[points.length - 1];
    const whole = { x: last.x - first.x, y: last.y - first.y, h: last.h - first.h };
    return Math.hypot(whole.x, whole.y, whole.h) > 1e-9 ? whole : { x: 0, y: -1, h: 0 };
  };

  const here = at(t);
  const unitVector = (v) => {
    const length = Math.hypot(v.x, v.y, v.h) || 1;
    return { x: v.x / length, y: v.y / length, h: v.h / length };
  };
  const blendAt = (time) => (look === 'ahead' ? 0 : Math.min(1, Math.max(0, resolveTrack(look.blend, time, 1))));
  const blend = blendAt(t);
  // Where the camera would face at `time`: ahead along the path, eased toward the look point.
  const facingAt = (time) => {
    const moment = clamp01(time);
    const ahead = unitVector(heading(moment));
    const amount = blendAt(moment);
    if (amount <= 0) return ahead;
    const from = at(moment);
    const point = { x: resolveTrack(look.x, moment, 0), y: resolveTrack(look.y, moment, 0), h: resolveTrack(look.h, moment, 0) };
    const toward = unitVector({ x: point.x - from.x, y: point.y - from.y, h: point.h - from.h });
    return unitVector({ x: ahead.x + (toward.x - ahead.x) * amount, y: ahead.y + (toward.y - ahead.y) * amount, h: ahead.h + (toward.h - ahead.h) * amount });
  };
  // A steadicam: the gaze is averaged over a short stretch of the clip
  // (`fly.smooth`, a fraction of the clip either side, default 0.02 - about
  // half a second of a 20 s reel), so passing close by the look point, or a
  // sharp kink in the path, turns the view smoothly instead of whipping it
  // round in a few frames.
  const smooth = Math.max(0, cam.fly.smooth ?? 0.02);
  let facing;
  if (smooth > 0) {
    const sum = { x: 0, y: 0, h: 0 };
    for (let k = -SMOOTH_TAPS; k <= SMOOTH_TAPS; k++) {
      const weight = 0.5 + 0.5 * Math.cos((Math.PI * k) / (SMOOTH_TAPS + 1));
      const f = facingAt(t + (smooth * k) / SMOOTH_TAPS);
      sum.x += f.x * weight;
      sum.y += f.y * weight;
      sum.h += f.h * weight;
    }
    facing = Math.hypot(sum.x, sum.y, sum.h) > 1e-6 ? unitVector(sum) : facingAt(t);
  } else {
    facing = facingAt(t);
  }
  const ahead = { x: here.x + facing.x, y: here.y + facing.y, h: here.h + facing.h };
  const position = world(here);
  const target = world(ahead);
  const horizon = Math.min(1, Math.max(0, resolveTrack(cam.fly.horizon, t, 1)));
  const up = flyUp(
    direction(position, target),
    direction(world({ x: 0, y: 0, h: 0 }), world({ x: 0, y: 0, h: 1 })),
    horizon
  );

  // Lean into the turn: how far the heading swings over a short stretch of the clip.
  const before = heading(t - 0.05);
  const after = heading(t + 0.05);
  let swing = Math.atan2(after.y, after.x) - Math.atan2(before.y, before.x);
  swing = Math.atan2(Math.sin(swing), Math.cos(swing));
  // A drone leans while it flies its path; turned to watch the piece it levels out.
  const lean = Math.max(-35, Math.min(35, ((-swing * 180) / Math.PI) * bank)) * (1 - blend);

  return {
    position,
    target,
    up,
    fov: resolveTrack(cam.fov, t, REEL_CAMERA_DEFAULTS.fov),
    roll: resolveTrack(cam.roll, t, 0) + lean,
    tilt: resolveTrack(cam.tilt, t, 0),
  };
}

const ROOM_UP = { x: 0, y: 1, z: 0 };
// Samples either side of the frame for the fly camera's steadicam.
const SMOOTH_TAPS = 6;
const dot3 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross3 = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });

function direction(from, to) {
  const v = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
  const length = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

/** `v` with its part along the unit vector `f` taken out, unit length - or null when `v` runs along `f`. */
function across(v, f) {
  const d = dot3(v, f);
  const o = { x: v.x - d * f.x, y: v.y - d * f.y, z: v.z - d * f.z };
  const length = Math.hypot(o.x, o.y, o.z);
  return length > 1e-6 ? { x: o.x / length, y: o.y / length, z: o.z / length } : null;
}

/**
 * Which way is up in the drone's picture (world, unit, square to where it
 * looks). `horizon` 1 (the default) flies with the board as the ground: the
 * board stays at the bottom of the picture and level, so a dive down a
 * wall-hung piece never turns upside down or tips sideways - the room's own
 * up only works for a board lying flat, where the two are the same. 0 keeps
 * the room's up, for a still of a wall-hung piece. Looking almost straight
 * into the board, where "the board below" has no direction, it eases to the
 * room's up rather than spinning.
 */
function flyUp(forward, normal, horizon) {
  const room = across(ROOM_UP, forward);
  const board = across(normal, forward);
  if (!room) return board ?? ROOM_UP;
  if (!board) return room;
  const faceOn = Math.abs(dot3(forward, normal));
  const ease = Math.min(1, Math.max(0, (0.995 - faceOn) / (0.995 - 0.94)));
  const amount = horizon * ease * ease * (3 - 2 * ease);
  if (amount >= 1) return board;
  if (amount <= 0) return room;
  // Turn the room's up toward the board's about the line of sight.
  const angle = Math.atan2(dot3(cross3(room, board), forward), dot3(room, board)) * amount;
  const side = cross3(forward, room);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: room.x * c + side.x * s, y: room.y * c + side.y * s, z: room.z * c + side.z * s };
}
