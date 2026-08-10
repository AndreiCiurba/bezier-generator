import { describe, it, expect } from 'vitest';
import { lerpColor, lerpColorStops } from './colorGradient.js';

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

describe('lerpColorStops', () => {
  const grey = [100, 100, 100];
  const yellow = [255, 204, 0];
  const red = [220, 40, 40];
  const stops = [grey, yellow, red];

  it('returns the first stop at t=0', () => {
    expect(lerpColorStops(stops, 0)).toEqual(grey);
  });

  it('returns the middle stop exactly at t=0.5', () => {
    expect(lerpColorStops(stops, 0.5)).toEqual(yellow);
  });

  it('returns the last stop only at t=1 - "pixel perfect" only right at the end', () => {
    expect(lerpColorStops(stops, 1)).toEqual(red);
  });

  it('interpolates within the first segment (grey->yellow) below t=0.5', () => {
    expect(lerpColorStops(stops, 0.25)).toEqual(lerpColor(grey, yellow, 0.5));
  });

  it('interpolates within the second segment (yellow->red) above t=0.5', () => {
    expect(lerpColorStops(stops, 0.75)).toEqual(lerpColor(yellow, red, 0.5));
  });

  it('never reaches the last stop before t=1', () => {
    const result = lerpColorStops(stops, 0.99);
    expect(result).not.toEqual(red);
  });

  it('clamps t outside [0, 1]', () => {
    expect(lerpColorStops(stops, -1)).toEqual(grey);
    expect(lerpColorStops(stops, 2)).toEqual(red);
  });

  it('returns the single color unchanged for a one-stop list', () => {
    expect(lerpColorStops([grey], 0.5)).toEqual(grey);
  });
});
