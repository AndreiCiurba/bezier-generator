import { describe, it, expect } from 'vitest';
import { resolveEnvironment, mountPoint, shadeStrand, wallShade, projectOntoMount, hexToRgb } from './reelLighting.js';
import { colorBands } from './reelCamera.js';

const white = { r: 1, g: 1, b: 1 };
const lit = (lights, ambient = 0) => ({ ambient: { color: white, intensity: ambient }, lights });
const sun = (toward, extra = {}) => ({ type: 'directional', color: white, intensity: 1, sheen: 0, toward, ...extra });

describe('colorBands', () => {
  it('gives each palette color an equal solid band of layers, bottom first, so 40 layers of 4 colors read as four clear tiers', () => {
    const bands = colorBands(['#a', '#b', '#c', '#d'], 40);
    expect(bands.filter((c) => c === '#a').length).toBe(10);
    expect(bands.slice(0, 10).every((c) => c === '#a')).toBe(true);
    expect(bands.slice(30).every((c) => c === '#d')).toBe(true);
  });
});

describe('mountPoint', () => {
  it('hangs the design upright on a wall so the design screen-up is world up and string height comes out of the wall', () => {
    expect(mountPoint({ x: 5, y: -10, h: 3 }, 'wall')).toEqual({ x: 5, y: 10, z: 3 });
    expect(mountPoint({ x: 5, y: -10, h: 3 }, 'board')).toEqual({ x: 5, y: 3, z: -10 });
  });
});

describe('lifting a piece onto the wall', () => {
  it('turns the flat board up continuously, matching the flat and wall mounts at its two ends', () => {
    const p = { x: 5, y: -10, h: 3 };
    const flat = mountPoint(p, 0);
    const up = mountPoint(p, 1);
    expect(flat.y).toBeCloseTo(3);
    expect(flat.z).toBeCloseTo(-10);
    expect(up.y).toBeCloseTo(10);
    expect(up.z).toBeCloseTo(3);
    expect(resolveEnvironment({ room: {}, mount: { keyframes: [{ t: 0, value: 0 }, { t: 1, value: 1 }] } }, 0.5, 1).mount).toBeCloseTo(0.5);
  });
});

describe('resolveEnvironment', () => {
  it('leaves the old unlit look alone when a recipe has no lighting or room', () => {
    expect(resolveEnvironment({}, 0.5, 100)).toEqual({ mount: 'board', lighting: null, room: null });
  });

  it('hangs the piece on the wall by default once there is a room, and casts shadows there', () => {
    const env = resolveEnvironment({ room: {}, lighting: { lights: [{ type: 'point', azimuth: 90, elevation: 30, distance: 2 }] } }, 0, 100);
    expect(env.mount).toBe('wall');
    expect(env.room.floorY).toBeLessThan(0);
    expect(env.lighting.lights[0].shadow).toBe(true);
    expect(env.lighting.lights[0].position.z).toBeGreaterThan(0);
  });

  it('turns a table lamp in the room into a real light at its bulb, so it lights the piece and throws shadows like any other', () => {
    const env = resolveEnvironment({ room: { floorAt: 2, lamps: [{ x: 2, z: 1, intensity: 0.8 }] } }, 0, 100);
    const light = env.lighting.lights[0];
    expect(light.type).toBe('point');
    expect(light.intensity).toBe(0.8);
    expect(light.shadow).toBe(true);
    expect(light.position.x).toBe(200);
    expect(light.position.y).toBeGreaterThan(env.room.lamps[0].standY);
    expect(env.room.lamps[0].standY).toBeGreaterThan(env.room.floorY);
  });

  it('animates a light switching on through its intensity track', () => {
    const recipe = { lighting: { lights: [{ type: 'directional', intensity: { keyframes: [{ t: 0, value: 0 }, { t: 1, value: 2 }] } }] } };
    expect(resolveEnvironment(recipe, 0, 1).lighting.lights[0].intensity).toBe(0);
    expect(resolveEnvironment(recipe, 1, 1).lighting.lights[0].intensity).toBe(2);
  });
});

describe('shadeStrand', () => {
  const eye = { x: 0, y: 0, z: 100 };
  const normal = { x: 0, y: 0, z: 1 };

  it('lights a thread brightest when the light falls across it and darkest when it runs along it, like real thread', () => {
    const light = lit([sun({ x: 1, y: 0, z: 0 })]);
    const across = shadeStrand(white, { x: 0, y: 0, z: 1 }, { x: 0, y: 10, z: 1 }, light, eye, { x: 1, y: 0, z: 0 });
    const along = shadeStrand(white, { x: 0, y: 0, z: 1 }, { x: 10, y: 0, z: 1 }, light, eye, { x: 1, y: 0, z: 0 });
    expect(across.r).toBeCloseTo(1);
    expect(along.r).toBeCloseTo(0);
  });

  it('keeps a light behind the wall from lighting the strings in front of it', () => {
    const behind = shadeStrand(white, { x: 0, y: 0, z: 1 }, { x: 0, y: 10, z: 1 }, lit([sun({ x: 0, y: 0, z: -1 })]), eye, normal);
    expect(behind.r).toBe(0);
  });

  it('tints strings with the light color, which is what makes a warm lamp and cool daylight look different', () => {
    const warm = lit([sun({ x: 0, y: 0, z: 1 }, { color: { r: 1, g: 0.5, b: 0.2 } })]);
    const shade = shadeStrand(white, { x: 0, y: 0, z: 1 }, { x: 0, y: 10, z: 1 }, warm, eye, normal);
    expect(shade.r).toBeGreaterThan(shade.b);
  });
});

describe('wallShade and projectOntoMount', () => {
  it('drops a lamp shadow onto the wall further out than the string, and shadows are the wall without that lamp', () => {
    const lamp = { type: 'point', color: white, intensity: 1, sheen: 0, position: { x: 0, y: 100, z: 100 }, reach: null };
    const shadow = projectOntoMount({ x: 0, y: 0, z: 50 }, lamp, 'wall');
    expect(shadow.z).toBe(0);
    expect(shadow.y).toBeCloseTo(-100);
    const lighting = lit([lamp], 0.2);
    const wall = hexToRgb('#ffffff');
    expect(wallShade(wall, shadow, { x: 0, y: 0, z: 1 }, lighting, lamp).r).toBeCloseTo(0.2);
    expect(wallShade(wall, shadow, { x: 0, y: 0, z: 1 }, lighting).r).toBeGreaterThan(0.2);
  });
});
