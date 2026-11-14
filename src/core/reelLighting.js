import { resolveTrack, resolveColor, resolveOrbitCamera } from './reelCamera.js';

/**
 * Lighting, wall mounting and the room for the woven reel scenes (Arrange
 * and Grid) - the pure half. `resolveEnvironment` turns a recipe's
 * `mount` / `lighting` / `room` into plain numbers for one clip time;
 * `shadeStrand`, `wallShade` and `projectOntoMount` are the per-string light
 * math `three-page/WovenFrameView.js` applies. No Three.js/DOM dependency.
 *
 * Strings are thin threads, not surfaces, so they are lit like hair
 * (Kajiya-Kay): a thread is brightest when the light falls across it and
 * dark when the light runs along it, with an optional narrow sheen.
 *
 * World space is Three's: Y up. `mount: "board"` (default) is the board lying
 * flat (design x,y -> world x,z, string height -> +y). `mount: "wall"` hangs
 * the same piece on a wall facing +z: design x -> world x, design y -> world
 * -y (the design's screen-up is up the wall), string height -> +z, out from
 * the wall. With the default camera azimuth 90 and elevation 0 the camera
 * faces the wall head-on.
 *
 * Recipe fields (every number may be a track, every color a color track):
 * - `mount`: `"board"` | `"wall"` (default `"wall"` when there is a `room`), or
 *   a track from 0 (flat) to 1 (on the wall) - the piece is turned up onto
 *   the wall during the clip (a making-of: strung on the bench, then hung).
 * - `lighting`: `{ background, ambient: {color, intensity}, lights: [...] }`.
 *   Each light: `type` `"point"` (placed like the orbit camera: `azimuth`,
 *   `elevation`, `distance`, `targetX/Y/Z`, in units) or `"directional"`
 *   (`azimuth`, `elevation` - where it shines from), plus `color`,
 *   `intensity` (1 = full white light), `sheen` (0..1, highlight strength),
 *   `reach` (point only, units: light halves at this distance; omitted = no
 *   falloff) and `shadow` (cast string shadows on the wall/board, default true
 *   in a room). Without `lighting` strings are drawn unlit, as before.
 * - `room`: `{ wall, floor, width, height, floorAt }` - colors, and sizes in
 *   units (`floorAt` = how far below the piece's center the floor is; `floor:
 *   false` for no floor), `brightness` (0..1, default 1: dims the room itself
 *   but not the piece - 0 hides the room, e.g. during a making-of on the
 *   bench), and `lamps`: table lamps standing in the room, each
 *   one also a point light. A lamp is `{ x, z, color, intensity, reach,
 *   sheen, shadow, table, tableHeight, height, shade, tableColor }`: `x`
 *   along the wall and `z` out from it (units, from the piece's center),
 *   `table` (default true) a small side table under it, `tableHeight` /
 *   `height` its sizes (units), `shade` the shade's color when off. The shade
 *   glows in the light's color as `intensity` rises - a step in the intensity
 *   track is the switch.
 */

export const ROOM_DEFAULTS = { wall: '#e9e4da', floor: '#5b4636', width: 9, height: 7, floorAt: 2.4 };
export const LAMP_DEFAULTS = { tableHeight: 1.3, height: 1.0, shade: '#d9cfc0', tableColor: '#4a3426', tableWidth: 1.5, tableDepth: 0.8 };
const SHEEN_POWER = 48;

const deg = (d) => (d * Math.PI) / 180;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * How upright a mount is, 0 (lying flat) .. 1 (on the wall): `"board"`,
 * `"wall"`, or a number in between while the piece is being lifted onto the wall.
 */
export function uprightOf(mount) {
  if (mount === 'wall') return 1;
  if (typeof mount === 'number') return clamp01(mount);
  return 0;
}

/** Mount plane normal (direction the strings stand out toward). */
export function mountNormal(mount) {
  const u = uprightOf(mount);
  if (u === 0) return { x: 0, y: 1, z: 0 };
  if (u === 1) return { x: 0, y: 0, z: 1 };
  const a = (u * Math.PI) / 2;
  return { x: 0, y: Math.cos(a), z: Math.sin(a) };
}

/**
 * A design-space point `{x, y, h}` in world space for the given mount: the
 * flat board turned up about the x axis by `uprightOf(mount)` x 90 degrees.
 */
export function mountPoint(p, mount) {
  const u = uprightOf(mount);
  if (u === 0) return { x: p.x, y: p.h, z: p.y };
  if (u === 1) return { x: p.x, y: -p.y, z: p.h };
  const a = (u * Math.PI) / 2;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x, y: p.h * c - p.y * s, z: p.h * s + p.y * c };
}

/** Parses `#rrggbb` / `#rgb` into 0..1 channels. */
export function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

function resolveLight(spec, t, unit) {
  const color = hexToRgb(resolveColor(spec.color ?? '#ffffff', t));
  const intensity = Math.max(0, resolveTrack(spec.intensity, t, 1));
  const base = { color, intensity, sheen: resolveTrack(spec.sheen, t, 0), shadow: spec.shadow };
  if (spec.type === 'directional') {
    const az = deg(resolveTrack(spec.azimuth, t, 90));
    const el = deg(resolveTrack(spec.elevation, t, 45));
    // `toward` points from the scene to the light.
    return { ...base, type: 'directional', toward: { x: Math.cos(el) * Math.cos(az), y: Math.sin(el), z: Math.cos(el) * Math.sin(az) } };
  }
  const pose = resolveOrbitCamera(
    { azimuth: spec.azimuth, elevation: spec.elevation, distance: spec.distance ?? 3, targetX: spec.targetX, targetY: spec.targetY, targetZ: spec.targetZ },
    t,
    unit
  );
  const reach = spec.reach === undefined ? null : resolveTrack(spec.reach, t, 1) * unit;
  return { ...base, type: 'point', position: pose.position, reach };
}

/**
 * @param {object} recipe
 * @param {number} t clip time 0..1
 * @param {number} unit world units per camera unit
 * @returns {{mount:'board'|'wall'|number, lighting:null|{background:string|null, ambient:{color:object,intensity:number}, lights:object[]}, room:null|{wall:string, floor:string|null, width:number, height:number, floorY:number}}}
 */
export function resolveEnvironment(recipe, t, unit) {
  const roomSpec = recipe.room ?? null;
  // A track (0 flat .. 1 on the wall) lifts the piece from the bench onto the wall during the clip.
  const mount = recipe.mount && typeof recipe.mount === 'object' ? clamp01(resolveTrack(recipe.mount, t, 1)) : recipe.mount ?? (roomSpec ? 'wall' : 'board');
  let lighting = null;
  if (recipe.lighting) {
    const spec = recipe.lighting;
    const ambient = spec.ambient ?? {};
    lighting = {
      background: spec.background ? resolveColor(spec.background, t) : null,
      ambient: { color: hexToRgb(resolveColor(ambient.color ?? '#ffffff', t)), intensity: Math.max(0, resolveTrack(ambient.intensity, t, 0.25)) },
      lights: (spec.lights ?? []).map((light) => {
        const resolved = resolveLight(light, t, unit);
        return { ...resolved, shadow: resolved.shadow ?? Boolean(roomSpec) };
      }),
    };
  }
  let room = null;
  if (roomSpec) {
    const value = (key) => resolveTrack(roomSpec[key], t, ROOM_DEFAULTS[key]);
    const floorY = -value('floorAt') * unit;
    room = {
      wall: resolveColor(roomSpec.wall ?? ROOM_DEFAULTS.wall, t),
      floor: roomSpec.floor === false ? null : resolveColor(roomSpec.floor ?? ROOM_DEFAULTS.floor, t),
      width: value('width') * unit,
      height: value('height') * unit,
      floorY,
      brightness: clamp01(resolveTrack(roomSpec.brightness, t, 1)),
      lamps: (roomSpec.lamps ?? []).map((spec) => resolveLamp(spec, t, unit, floorY)),
    };
    if (room.lamps.length) {
      lighting ??= { background: null, ambient: { color: hexToRgb('#ffffff'), intensity: 0.25 }, lights: [] };
      lighting.lights.push(...room.lamps.map((lamp) => lamp.light));
    }
  }
  return { mount, lighting, room };
}

function resolveLamp(spec, t, unit, floorY) {
  const value = (key) => resolveTrack(spec[key], t, LAMP_DEFAULTS[key]);
  const hasTable = spec.table !== false;
  const standY = hasTable ? floorY + value('tableHeight') * unit : floorY;
  const height = value('height') * unit;
  const x = resolveTrack(spec.x, t, 2) * unit;
  const z = resolveTrack(spec.z, t, 0.8) * unit;
  // The bulb sits inside the shade, which takes up the lamp's top 40%.
  const bulb = { x, y: standY + height * 0.78, z };
  const light = {
    type: 'point',
    color: hexToRgb(resolveColor(spec.color ?? '#ffcf8a', t)),
    intensity: Math.max(0, resolveTrack(spec.intensity, t, 1.2)),
    sheen: resolveTrack(spec.sheen, t, 0.4),
    shadow: spec.shadow ?? true,
    position: bulb,
    reach: resolveTrack(spec.reach, t, 1.6) * unit,
  };
  return {
    light,
    x,
    z,
    standY,
    height,
    floorY,
    table: hasTable ? { width: value('tableWidth') * unit, depth: value('tableDepth') * unit, color: resolveColor(spec.tableColor ?? LAMP_DEFAULTS.tableColor, t) } : null,
    shade: resolveColor(spec.shade ?? LAMP_DEFAULTS.shade, t),
  };
}

function lightToward(light, at) {
  if (light.type === 'directional') return { dir: light.toward, falloff: 1 };
  const dx = light.position.x - at.x;
  const dy = light.position.y - at.y;
  const dz = light.position.z - at.z;
  const d = Math.hypot(dx, dy, dz) || 1;
  const falloff = light.reach ? 1 / (1 + (d / light.reach) ** 2) : 1;
  return { dir: { x: dx / d, y: dy / d, z: dz / d }, falloff };
}

const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

// Lights behind the board/wall do not reach the strings; a soft edge instead of a hard cut.
const facingFactor = (normal, dir) => clamp01((dot(normal, dir) + 0.15) / 0.3);

/**
 * The lit color of one string running from world point `a` to `b`.
 * @param {{r:number,g:number,b:number}} base the string's own color
 * @param {{x:number,y:number,z:number}} a
 * @param {{x:number,y:number,z:number}} b
 * @param {object} lighting a resolved `lighting`
 * @param {{x:number,y:number,z:number}} eye camera position
 * @param {{x:number,y:number,z:number}} normal the mount normal
 * @returns {{r:number,g:number,b:number}}
 */
export function shadeStrand(base, a, b, lighting, eye, normal) {
  const tx = b.x - a.x;
  const ty = b.y - a.y;
  const tz = b.z - a.z;
  const tl = Math.hypot(tx, ty, tz) || 1;
  const tangent = { x: tx / tl, y: ty / tl, z: tz / tl };
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
  const vx = eye.x - mid.x;
  const vy = eye.y - mid.y;
  const vz = eye.z - mid.z;
  const vl = Math.hypot(vx, vy, vz) || 1;
  const view = { x: vx / vl, y: vy / vl, z: vz / vl };

  const { ambient } = lighting;
  let dr = ambient.color.r * ambient.intensity;
  let dg = ambient.color.g * ambient.intensity;
  let db = ambient.color.b * ambient.intensity;
  let sr = 0;
  let sg = 0;
  let sb = 0;
  for (const light of lighting.lights) {
    if (light.intensity <= 0) continue;
    const { dir, falloff } = lightToward(light, mid);
    const cosTL = dot(tangent, dir);
    const diffuse = Math.sqrt(Math.max(0, 1 - cosTL * cosTL));
    const strength = light.intensity * falloff * facingFactor(normal, dir);
    dr += light.color.r * strength * diffuse;
    dg += light.color.g * strength * diffuse;
    db += light.color.b * strength * diffuse;
    if (light.sheen > 0) {
      const hx = dir.x + view.x;
      const hy = dir.y + view.y;
      const hz = dir.z + view.z;
      const hl = Math.hypot(hx, hy, hz) || 1;
      const cosTH = (tangent.x * hx + tangent.y * hy + tangent.z * hz) / hl;
      const spec = light.sheen * strength * Math.max(0, 1 - cosTH * cosTH) ** (SHEEN_POWER / 2);
      sr += light.color.r * spec;
      sg += light.color.g * spec;
      sb += light.color.b * spec;
    }
  }
  return { r: clamp01(base.r * dr + sr), g: clamp01(base.g * dg + sg), b: clamp01(base.b * db + sb) };
}

/**
 * The lit color of a matte surface (the wall or board) at world point `at`,
 * leaving out light `skip` - which is exactly the color of `skip`'s shadow there.
 */
export function wallShade(base, at, normal, lighting, skip = null) {
  const { ambient } = lighting;
  let r = ambient.color.r * ambient.intensity;
  let g = ambient.color.g * ambient.intensity;
  let b = ambient.color.b * ambient.intensity;
  for (const light of lighting.lights) {
    if (light === skip || light.intensity <= 0) continue;
    const { dir, falloff } = lightToward(light, at);
    const lambert = Math.max(0, dot(normal, dir)) * light.intensity * falloff;
    r += light.color.r * lambert;
    g += light.color.g * lambert;
    b += light.color.b * lambert;
  }
  return { r: clamp01(base.r * r), g: clamp01(base.g * g), b: clamp01(base.b * b) };
}

/**
 * Where world point `p` (in front of the mount plane) casts its shadow on the
 * plane, lit by `light`; `null` when the light is behind or level with it.
 */
export function projectOntoMount(p, light, mount) {
  const n = mountNormal(mount);
  const np = dot(n, p);
  if (light.type === 'directional') {
    const nd = dot(n, light.toward);
    if (nd <= 1e-3) return null;
    const s = np / nd;
    return { x: p.x - light.toward.x * s, y: p.y - light.toward.y * s, z: p.z - light.toward.z * s };
  }
  const L = light.position;
  const nl = dot(n, L);
  if (nl <= np + 1e-6) return null;
  const s = nl / (nl - np);
  return { x: L.x + (p.x - L.x) * s, y: L.y + (p.y - L.y) * s, z: L.z + (p.z - L.z) * s };
}
