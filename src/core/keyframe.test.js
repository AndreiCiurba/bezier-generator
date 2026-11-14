import { describe, it, expect } from 'vitest';
import { interpolateNumber, interpolateColor, resolveEasing, wobble } from './keyframe.js';

describe('interpolateNumber', () => {
  it('lerps linearly between two keyframes at the midpoint', () => {
    expect(interpolateNumber([{ t: 0, value: 0 }, { t: 1, value: 100 }], 0.5)).toBeCloseTo(50, 10);
  });

  it('holds the first value for t at-or-before the first keyframe', () => {
    const keyframes = [{ t: 0.2, value: 10 }, { t: 0.8, value: 20 }];
    expect(interpolateNumber(keyframes, 0)).toBe(10);
    expect(interpolateNumber(keyframes, 0.2)).toBe(10);
  });

  it('holds the last value for t at-or-after the last keyframe', () => {
    const keyframes = [{ t: 0.2, value: 10 }, { t: 0.8, value: 20 }];
    expect(interpolateNumber(keyframes, 0.8)).toBe(20);
    expect(interpolateNumber(keyframes, 1)).toBe(20);
  });

  it('a single keyframe returns a constant value regardless of t', () => {
    const keyframes = [{ t: 0.5, value: 42 }];
    expect(interpolateNumber(keyframes, 0)).toBe(42);
    expect(interpolateNumber(keyframes, 1)).toBe(42);
  });

  it('interpolates across more than two keyframes, picking the right segment', () => {
    const keyframes = [{ t: 0, value: 0 }, { t: 0.5, value: 100 }, { t: 1, value: 0 }];
    expect(interpolateNumber(keyframes, 0.25)).toBeCloseTo(50, 10);
    expect(interpolateNumber(keyframes, 0.75)).toBeCloseTo(50, 10);
    expect(interpolateNumber(keyframes, 0.5)).toBeCloseTo(100, 10);
  });

  it('does not require keyframes to be pre-sorted', () => {
    const sorted = [{ t: 0, value: 0 }, { t: 1, value: 100 }];
    const reversed = [{ t: 1, value: 100 }, { t: 0, value: 0 }];
    expect(interpolateNumber(reversed, 0.5)).toBe(interpolateNumber(sorted, 0.5));
  });

  it('easeInOutQuad differs from linear away from the endpoints/midpoint', () => {
    const keyframes = [{ t: 0, value: 0 }, { t: 1, value: 100 }];
    const linearValue = interpolateNumber(keyframes, 0.25, 'linear');
    const easedValue = interpolateNumber(keyframes, 0.25, 'easeInOutQuad');
    expect(easedValue).not.toBeCloseTo(linearValue, 5);
  });

  it('an unknown easing name falls back to linear rather than throwing', () => {
    const keyframes = [{ t: 0, value: 0 }, { t: 1, value: 100 }];
    expect(interpolateNumber(keyframes, 0.5, 'not-a-real-easing')).toBeCloseTo(50, 10);
  });
});

describe('interpolateColor', () => {
  it('lerps each RGB channel independently at the midpoint', () => {
    const keyframes = [{ t: 0, value: '#000000' }, { t: 1, value: '#ffffff' }];
    expect(interpolateColor(keyframes, 0.5)).toBe('#808080');
  });

  it('holds the endpoint color outside the keyframe range', () => {
    const keyframes = [{ t: 0.2, value: '#ff0000' }, { t: 0.8, value: '#00ff00' }];
    expect(interpolateColor(keyframes, 0)).toBe('#ff0000');
    expect(interpolateColor(keyframes, 1)).toBe('#00ff00');
  });
});

describe('wobble', () => {
  it('is zero everywhere when amplitude is 0 or omitted', () => {
    expect(wobble(0.3)).toBe(0);
    expect(wobble(0.3, { amplitude: 0, frequency: 5 })).toBe(0);
  });

  it('stays within [-amplitude, amplitude]', () => {
    const amplitude = 10;
    for (let t = 0; t <= 1; t += 0.01) {
      const value = wobble(t, { amplitude, frequency: 3 });
      expect(Math.abs(value)).toBeLessThanOrEqual(amplitude + 1e-9);
    }
  });

  it('is deterministic - the same t/config always produces the same offset', () => {
    const config = { amplitude: 5, frequency: 2, seed: 1.2 };
    expect(wobble(0.42, config)).toBe(wobble(0.42, config));
  });

  it('a different seed shifts the offset at the same t', () => {
    const a = wobble(0.42, { amplitude: 5, frequency: 2, seed: 0 });
    const b = wobble(0.42, { amplitude: 5, frequency: 2, seed: 3 });
    expect(a).not.toBe(b);
  });
});

describe('per-keyframe easing', () => {
  it('lets one keyframe shape the move arriving at it, so a single track can drift and then snap', () => {
    const keyframes = [{ t: 0, value: 0 }, { t: 0.5, value: 10 }, { t: 1, value: 20, easing: 'easeOutExpo' }];
    expect(interpolateNumber(keyframes, 0.25)).toBeCloseTo(5); // first move: the track's (linear) easing
    expect(interpolateNumber(keyframes, 0.6)).toBeGreaterThan(17); // second move: most of the way there almost at once
  });

  it('takes precedence over the easing given for the whole track', () => {
    const keyframes = [{ t: 0, value: 0 }, { t: 1, value: 10, easing: 'linear' }];
    expect(interpolateNumber(keyframes, 0.25, 'easeInCubic')).toBeCloseTo(2.5);
  });
});

describe('resolveEasing', () => {
  it('passes a function through unchanged', () => {
    const custom = (t) => t * 2;
    expect(resolveEasing(custom)).toBe(custom);
  });

  it('falls back to linear for an unrecognized name', () => {
    expect(resolveEasing('nonsense')(0.3)).toBeCloseTo(0.3, 10);
  });

  it('every named easing starts at 0 and ends at 1, so a keyframe pair always lands exactly on its two values', () => {
    for (const name of ['linear', 'easeInOutQuad', 'easeInCubic', 'easeOutCubic', 'easeInOutCubic', 'easeOutExpo', 'easeInOutExpo']) {
      expect(resolveEasing(name)(0)).toBeCloseTo(0, 10);
      expect(resolveEasing(name)(1)).toBeCloseTo(1, 10);
    }
  });

  it('easeOutCubic is ahead of linear mid-way and easeInCubic behind it - the fast-then-settle and slow-then-rush camera moves', () => {
    expect(resolveEasing('easeOutCubic')(0.5)).toBeGreaterThan(0.5);
    expect(resolveEasing('easeInCubic')(0.5)).toBeLessThan(0.5);
  });
});
