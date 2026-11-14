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
 * @param {object|undefined} cam
 * @param {number} t
 * @param {number} unit
 * @param {(p:{x:number,y:number,h:number}) => {x:number,y:number,z:number}} [place] board point to world (fly mode only)
 * @returns {{position:{x:number,y:number,z:number}, target:{x:number,y:number,z:number}, fov:number, roll:number, tilt:number}}
 */
export function resolveOrbitCamera(cam = {}, t, unit, place) {
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

/** How far through its own window [start, end] of an overall 0..1 progress something is. */
export function windowProgress(progress, start = 0, end = 1) {
  if (end <= start) return progress >= end ? 1 : 0;
  return Math.min(1, Math.max(0, (progress - start) / (end - start)));
}

// Board point (x, y across the board, h up off it) to world, for a board lying flat.
const FLAT = (p) => ({ x: p.x, y: p.h, z: p.y });

/**
 * A point on a time-knotted Catmull-Rom curve through `points` (each
 * `{ t, x, y, h }`) at clip time `t` - the Barry-Goldman form, so the speed
 * stays smooth across waypoints however unevenly they are spaced in time.
 * Held at the ends outside the first and last waypoints.
 */
export function flyPathPoint(points, t) {
  const n = points.length;
  if (n === 1 || t <= points[0].t) return { x: points[0].x, y: points[0].y, h: points[0].h };
  if (t >= points[n - 1].t) return { x: points[n - 1].x, y: points[n - 1].y, h: points[n - 1].h };
  let i = 0;
  while (points[i + 1].t < t) i++;
  // Mirror a phantom waypoint past each end so the first and last spans curve like the rest.
  const at = (k) => {
    if (k >= 0 && k < n) return points[k];
    const [edge, inner] = k < 0 ? [points[0], points[1]] : [points[n - 1], points[n - 2]];
    return { t: 2 * edge.t - inner.t, x: 2 * edge.x - inner.x, y: 2 * edge.y - inner.y, h: 2 * edge.h - inner.h };
  };
  const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
  const mix = (a, b, ta, tb) => {
    const w = tb === ta ? 0 : (t - ta) / (tb - ta);
    return { x: a.x + (b.x - a.x) * w, y: a.y + (b.y - a.y) * w, h: a.h + (b.h - a.h) * w };
  };
  const a1 = mix(p0, p1, p0.t, p1.t);
  const a2 = mix(p1, p2, p1.t, p2.t);
  const a3 = mix(p2, p3, p2.t, p3.t);
  const b1 = mix(a1, a2, p0.t, p2.t);
  const b2 = mix(a2, a3, p1.t, p3.t);
  return mix(b1, b2, p1.t, p2.t);
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
 * (0 = level, 1 = about 30 degrees in a tight turn; default 0.4). `fov`,
 * `tilt` (pitch up/down from the heading) and `roll` are the usual tracks.
 * `place` maps a board point to world (the board flat by default; wall-hung
 * pieces pass their mount).
 */
export function resolveFlyCamera(cam, t, unit, place = FLAT) {
  const { path = [], look = 'ahead', bank = 0.4 } = cam.fly;
  const points = path.map((p) => ({ t: p.t, x: p.x ?? 0, y: p.y ?? 0, h: p.h ?? 0 })).sort((a, b) => a.t - b.t);
  if (points.length === 0) points.push({ t: 0, x: 0, y: 0, h: 1 });
  const world = (p) => {
    const w = place(p);
    return { x: w.x * unit, y: w.y * unit, z: w.z * unit };
  };
  const at = (time) => flyPathPoint(points, Math.min(1, Math.max(0, time)));
  // Which way the path runs at `time`, on the board: widen the window until it moves.
  const heading = (time) => {
    for (let d = 0.004; d <= 1; d *= 2) {
      const a = at(time - d);
      const b = at(time + d);
      const v = { x: b.x - a.x, y: b.y - a.y, h: b.h - a.h };
      if (Math.hypot(v.x, v.y, v.h) > 1e-6) return v;
    }
    return { x: 0, y: -1, h: 0 };
  };

  const here = at(t);
  const unitVector = (v) => {
    const length = Math.hypot(v.x, v.y, v.h) || 1;
    return { x: v.x / length, y: v.y / length, h: v.h / length };
  };
  let facing = unitVector(heading(t));
  const blend = look === 'ahead' ? 0 : Math.min(1, Math.max(0, resolveTrack(look.blend, t, 1)));
  if (blend > 0) {
    const point = { x: resolveTrack(look.x, t, 0), y: resolveTrack(look.y, t, 0), h: resolveTrack(look.h, t, 0) };
    const toward = unitVector({ x: point.x - here.x, y: point.y - here.y, h: point.h - here.h });
    facing = unitVector({ x: facing.x + (toward.x - facing.x) * blend, y: facing.y + (toward.y - facing.y) * blend, h: facing.h + (toward.h - facing.h) * blend });
  }
  const ahead = { x: here.x + facing.x, y: here.y + facing.y, h: here.h + facing.h };

  // Lean into the turn: how far the heading swings over a short stretch of the clip.
  const before = heading(t - 0.05);
  const after = heading(t + 0.05);
  let swing = Math.atan2(after.y, after.x) - Math.atan2(before.y, before.x);
  swing = Math.atan2(Math.sin(swing), Math.cos(swing));
  const lean = Math.max(-35, Math.min(35, (-swing * 180) / Math.PI * bank));

  return {
    position: world(here),
    target: world(ahead),
    fov: resolveTrack(cam.fov, t, REEL_CAMERA_DEFAULTS.fov),
    roll: resolveTrack(cam.roll, t, 0) + lean,
    tilt: resolveTrack(cam.tilt, t, 0),
  };
}
