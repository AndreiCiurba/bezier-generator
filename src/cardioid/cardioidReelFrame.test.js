import { describe, it, expect } from 'vitest';
import { resolveCardioidFrame, resolveTrack, layerGradient, hammerRaise, REEL_WEAVE_DEFAULTS, REEL_CAMERA_DEFAULTS } from './cardioidReelFrame.js';

describe('resolveTrack', () => {
  it('passes a plain number through, so a recipe only spells out a track for what actually moves', () => {
    expect(resolveTrack(7, 0.3, 99)).toBe(7);
  });

  it('falls back to the default when the recipe leaves the value out', () => {
    expect(resolveTrack(undefined, 0.3, 99)).toBe(99);
  });

  it('interpolates a keyframe track at clip time t', () => {
    const track = { keyframes: [{ t: 0, value: 2 }, { t: 1, value: 4 }] };
    expect(resolveTrack(track, 0.25, 0)).toBeCloseTo(2.5);
  });

  it('adds wobble on top of a constant, for a held shot that still drifts a little', () => {
    const steady = resolveTrack({ value: 10 }, 0.4, 0);
    const drifting = resolveTrack({ value: 10, wobble: { amplitude: 2, frequency: 3 } }, 0.4, 0);
    expect(steady).toBe(10);
    expect(drifting).not.toBe(10);
    expect(Math.abs(drifting - 10)).toBeLessThanOrEqual(2);
  });
});

describe('layerGradient', () => {
  it('runs from the first color on the bottom layer to the last color on the top one', () => {
    const gradient = layerGradient(['#000000', '#ffffff'], 3);
    expect(gradient).toEqual(['#000000', '#808080', '#ffffff']);
  });

  it('gives every layer the same color when there is only one to choose from', () => {
    expect(layerGradient(['#ff0000'], 3)).toEqual(['#ff0000', '#ff0000', '#ff0000']);
  });
});

describe('resolveCardioidFrame', () => {
  it('fills in a complete, renderable frame from an empty recipe, so every field in a recipe is optional', () => {
    const { settings, camera } = resolveCardioidFrame({}, 0.5);
    expect(settings).toMatchObject({ ...REEL_WEAVE_DEFAULTS, colors: ['#ffffff'], layerColors: null, drawMode: 'sequential' });
    expect(camera.fov).toBe(REEL_CAMERA_DEFAULTS.fov);
    expect(Number.isFinite(camera.position.x + camera.position.y + camera.position.z)).toBe(true);
  });

  it('keeps a tweened multiplier fractional - the smooth times-table morph - but rounds counts of nails and layers', () => {
    const recipe = {
      weave: {
        multiplier: { keyframes: [{ t: 0, value: 2 }, { t: 1, value: 3 }] },
        nailCount: { keyframes: [{ t: 0, value: 10 }, { t: 1, value: 11 }] },
      },
    };
    const { settings } = resolveCardioidFrame(recipe, 0.3);
    expect(settings.multiplier).toBeCloseTo(2.3);
    expect(Number.isInteger(settings.nailCount)).toBe(true);
  });

  it('animates a color track and passes plain colors through', () => {
    const recipe = { colors: ['#112233', { keyframes: [{ t: 0, color: '#000000' }, { t: 1, color: '#ffffff' }] }] };
    expect(resolveCardioidFrame(recipe, 0.5).settings.colors).toEqual(['#112233', '#808080']);
  });

  it('only builds per-layer colors in "layer" color mode, leaving the board\'s own per-arc split alone otherwise', () => {
    const recipe = { weave: { layerCount: 2 }, colors: ['#000000', '#ffffff'] };
    expect(resolveCardioidFrame(recipe, 0).settings.layerColors).toBeNull();
    expect(resolveCardioidFrame({ ...recipe, colorMode: 'layer' }, 0).settings.layerColors).toEqual(['#000000', '#ffffff']);
  });

  it('measures camera distance in circle radii, so a recipe frames the board the same at any board size', () => {
    const at = (radius) => resolveCardioidFrame({ weave: { radius }, camera: { azimuth: 0, elevation: 0, distance: 3 } }, 0).camera.position;
    expect(at(1000).x).toBeCloseTo(3000);
    expect(at(2000).x).toBeCloseTo(6000);
  });

  it('orbits round the target at the given azimuth and rises with elevation', () => {
    const { position } = resolveCardioidFrame({ weave: { radius: 100 }, camera: { azimuth: 90, elevation: 30, distance: 2 } }, 0).camera;
    expect(position.x).toBeCloseTo(0);
    expect(position.y).toBeCloseTo(100); // 200 * sin(30)
    expect(position.z).toBeCloseTo(200 * Math.cos(Math.PI / 6));
  });

  it('moves the camera with its target, which is what makes a pan a pan rather than a turn', () => {
    const base = { weave: { radius: 100 }, camera: { azimuth: 0, elevation: 0, distance: 2 } };
    const panned = { ...base, camera: { ...base.camera, targetZ: 0.5 } };
    const a = resolveCardioidFrame(base, 0).camera;
    const b = resolveCardioidFrame(panned, 0).camera;
    expect(b.target.z).toBeCloseTo(50);
    expect(b.position.z - a.position.z).toBeCloseTo(50);
  });

  it('stops a top-down shot just short of vertical, where a look-at camera has no defined "up"', () => {
    const { position } = resolveCardioidFrame({ weave: { radius: 100 }, camera: { azimuth: 90, elevation: 90, distance: 1 } }, 0).camera;
    expect(position.z).toBeGreaterThan(0);
    expect(position.y).toBeGreaterThan(99.9);
  });

  it('clamps time outside the clip to its first and last frame', () => {
    const recipe = { weave: { drawProgress: { keyframes: [{ t: 0, value: 0 }, { t: 1, value: 1 }] } } };
    expect(resolveCardioidFrame(recipe, -2).settings.drawProgress).toBe(0);
    expect(resolveCardioidFrame(recipe, 5).settings.drawProgress).toBe(1);
  });

  it('has no making-of stages unless the recipe asks for them, and then every nail is in', () => {
    const { making, settings } = resolveCardioidFrame({}, 0.5);
    expect(making).toBeNull();
    expect(settings.nailProgress).toBe(1);
  });

  it('resolves the making-of stages and hands the nail stage on to the board', () => {
    const recipe = { making: { paint: { keyframes: [{ t: 0, value: 0 }, { t: 0.5, value: 1 }] }, nails: { keyframes: [{ t: 0.5, value: 0 }, { t: 1, value: 1 }] } } };
    const { making, settings } = resolveCardioidFrame(recipe, 0.75);
    expect(making).toEqual({ paint: 1, nails: 0.5 });
    expect(settings.nailProgress).toBe(0.5);
  });
});

describe('resolveCardioidFrame explain and tilt', () => {
  it('picks out no string unless the recipe is explaining the rule', () => {
    expect(resolveCardioidFrame({}, 0).settings.highlight).toBeNull();
  });

  it('walks the picked-out string from nail to nail as its track plays', () => {
    const recipe = { explain: { chord: { keyframes: [{ t: 0, value: 1 }, { t: 1, value: 5 }] } } };
    expect(resolveCardioidFrame(recipe, 0.5).settings.highlight).toMatchObject({ chord: 3, color: '#ffffff' });
  });

  it('passes tilt through untouched, since turning the camera in place does not move it', () => {
    const level = resolveCardioidFrame({ camera: { tilt: 0 } }, 0).camera;
    const tilted = resolveCardioidFrame({ camera: { tilt: 90 } }, 0).camera;
    expect(tilted.tilt).toBe(90);
    expect(tilted.position).toEqual(level.position);
  });
});

describe('hammerRaise', () => {
  it('is in contact with the nail at the end of every blow, which is when the nail should be seen to move', () => {
    expect(hammerRaise(1 / 3 - 1e-9, 3)).toBeCloseTo(0, 5);
    expect(hammerRaise(2 / 3 - 1e-9, 3)).toBeCloseTo(0, 5);
  });

  it('is fully raised part-way through a blow', () => {
    expect(hammerRaise(0.55 / 3, 3)).toBeCloseTo(1);
  });

  it('never leaves the range between contact and fully raised', () => {
    for (let f = 0; f <= 1; f += 0.01) {
      expect(hammerRaise(f)).toBeGreaterThanOrEqual(0);
      expect(hammerRaise(f)).toBeLessThanOrEqual(1);
    }
  });
});
