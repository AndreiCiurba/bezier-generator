import { describe, it, expect } from 'vitest';
import { lerpColor } from './colorGradient.js';

describe('lerpColor', () => {
  const grey = [100, 100, 100];
  const red = [220, 40, 40];

  it('returns colorA at t=0', () => {
    expect(lerpColor(grey, red, 0)).toEqual(grey);
  });

  it('returns colorB at t=1', () => {
    expect(lerpColor(grey, red, 1)).toEqual(red);
  });

  it('interpolates each channel independently at t=0.5', () => {
    expect(lerpColor(grey, red, 0.5)).toEqual([160, 70, 70]);
  });

  it('clamps t above 1', () => {
    expect(lerpColor(grey, red, 2)).toEqual(red);
  });

  it('clamps t below 0', () => {
    expect(lerpColor(grey, red, -1)).toEqual(grey);
  });
});
