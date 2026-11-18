import { describe, it, expect } from 'vitest';
import { transitionList, transitionCameraOffset, withTransitions, motionBlurAt, transitionOverlays, transitionWindows } from './reelTransitions.js';

const SECONDS = 20;
// One second either side of the middle of the clip.
const at = (seconds) => 0.5 + seconds / SECONDS;

describe('transitionList', () => {
  it('fills in each type\'s own length and drops what it does not know, so a typo cannot break a render', () => {
    const list = transitionList({ transitions: [{ type: 'flash', t: 0.6 }, { type: 'spin', t: 0.2 }, { type: 'wobble', t: 0.3 }] });
    expect(list.map((tr) => tr.type)).toEqual(['spin', 'flash']);
    expect(list[0].seconds).toBe(0.7);
  });
});

describe('transitionCameraOffset', () => {
  const spin = transitionList({ transitions: [{ type: 'spin', t: 0.5, seconds: 1 }] });

  it('leaves the camera alone outside a transition, so the shots either side are untouched', () => {
    expect(transitionCameraOffset(spin, at(-0.6), SECONDS)).toEqual({ roll: 0, yaw: 0, zoom: 1 });
    expect(transitionCameraOffset(spin, at(0.6), SECONDS)).toEqual({ roll: 0, yaw: 0, zoom: 1 });
  });

  it('turns a spin through a whole circle, half of it by the cut, so it lands upright in the next shot', () => {
    expect(transitionCameraOffset(spin, 0.5, SECONDS).roll).toBeCloseTo(180);
    expect(transitionCameraOffset(spin, at(0.5), SECONDS).roll).toBeCloseTo(360);
    const reversed = transitionList({ transitions: [{ type: 'spin', t: 0.5, seconds: 1, turns: -1 }] });
    expect(transitionCameraOffset(reversed, 0.5, SECONDS).roll).toBeCloseTo(-180);
  });

  it('spins fastest at the cut, where the blur hides the jump to the next shot', () => {
    const step = 1 / (30 * SECONDS);
    const speed = (t) => Math.abs(transitionCameraOffset(spin, t + step, SECONDS).roll - transitionCameraOffset(spin, t, SECONDS).roll);
    expect(speed(0.5 - step / 2)).toBeGreaterThan(speed(at(-0.3)));
    expect(speed(0.5 - step / 2)).toBeGreaterThan(speed(at(0.3)));
  });

  it('swings a whip pan out of one side and in from the other, ending level', () => {
    const whip = transitionList({ transitions: [{ type: 'whip', t: 0.5, seconds: 1, angle: 80 }] });
    expect(transitionCameraOffset(whip, at(-0.01), SECONDS).yaw).toBeGreaterThan(70);
    expect(transitionCameraOffset(whip, at(0.01), SECONDS).yaw).toBeLessThan(-70);
    expect(transitionCameraOffset(whip, at(0.5), SECONDS).yaw).toBeCloseTo(0);
  });

  it('punches a zoom in to its peak at the cut and back out', () => {
    const zoom = transitionList({ transitions: [{ type: 'zoom', t: 0.5, seconds: 1, zoom: 3 }] });
    expect(transitionCameraOffset(zoom, 0.5, SECONDS).zoom).toBeCloseTo(3);
    expect(transitionCameraOffset(zoom, at(-0.25), SECONDS).zoom).toBeLessThan(3);
    expect(transitionCameraOffset(zoom, at(0.5), SECONDS).zoom).toBeCloseTo(1);
  });
});

describe('withTransitions', () => {
  it('adds the spin to the camera\'s own roll rather than replacing it', () => {
    const pose = { position: { x: 0, y: 0, z: 1 }, target: { x: 0, y: 0, z: 0 }, fov: 50, roll: 5, tilt: 0 };
    const recipe = { durationSeconds: SECONDS, transitions: [{ type: 'spin', t: 0.5, seconds: 1 }] };
    expect(withTransitions(pose, recipe, 0.5).roll).toBeCloseTo(185);
    expect(withTransitions(pose, { durationSeconds: SECONDS }, 0.5)).toBe(pose);
  });
});

describe('motionBlurAt', () => {
  const transitions = transitionList({ transitions: [{ type: 'spin', t: 0.5, seconds: 1 }, { type: 'flash', t: 0.8 }] });

  it('blurs only the frames of a moving transition, so the rest of the reel renders at full speed and sharp', () => {
    expect(motionBlurAt(transitions, 0.5, SECONDS)).toEqual({ shutter: 0.5 / (30 * SECONDS), samples: 32 });
    // Slow near its ends, so a few moments a frame are plenty there.
    expect(motionBlurAt(transitions, at(-0.48), SECONDS).samples).toBe(4);
    expect(motionBlurAt(transitions, at(1), SECONDS)).toBeNull();
    // A flash is laid over in the edit; it moves nothing, so nothing to blur.
    expect(motionBlurAt(transitions, 0.8, SECONDS)).toBeNull();
  });
});

describe('transitionOverlays', () => {
  it('bursts a flash in fast and lets it fade slowly, peaking on the cut', () => {
    const [flash] = transitionOverlays(transitionList({ transitions: [{ type: 'flash', t: 0.5, seconds: 0.5 }] }), SECONDS);
    expect(flash).toEqual({ color: '#ffffff', strength: 0.85, start: 9.9, peak: 10, end: 10.4 });
  });

  it('dips evenly to black and back', () => {
    const [dip] = transitionOverlays(transitionList({ transitions: [{ type: 'dip', t: 0.5, seconds: 1 }] }), SECONDS);
    expect(dip).toEqual({ color: '#000000', strength: 1, start: 9.5, peak: 10, end: 10.5 });
  });
});

describe('transitionWindows', () => {
  it('marks where a fast turn is meant, for the framing check to let through', () => {
    const windows = transitionWindows(transitionList({ transitions: [{ type: 'whip', t: 0.5, seconds: 1 }, { type: 'dip', t: 0.2 }] }), SECONDS);
    expect(windows).toEqual([[0.475, 0.525]]);
  });
});
