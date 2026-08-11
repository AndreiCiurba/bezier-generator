import { describe, it, expect } from 'vitest';
import { flipPoints, translatePointsTo } from './pointTransforms.js';

const shape = [
  { x: 10, y: 10 },
  { x: 20, y: 10 },
  { x: 20, y: 30 },
];

describe('flipPoints', () => {
  it('returns an equivalent (unflipped) copy when neither flag is set', () => {
    expect(flipPoints(shape)).toEqual(shape);
  });

  it('keeps points[0] fixed under any flip combination', () => {
    expect(flipPoints(shape, { horizontal: true })[0]).toEqual(shape[0]);
    expect(flipPoints(shape, { vertical: true })[0]).toEqual(shape[0]);
    expect(flipPoints(shape, { horizontal: true, vertical: true })[0]).toEqual(shape[0]);
  });

  it('mirrors x around points[0].x when horizontal', () => {
    const flipped = flipPoints(shape, { horizontal: true });
    // points[0].x=10; point at x=20 is +10 from pivot, so mirrors to 10-10=0
    expect(flipped[1]).toEqual({ x: 0, y: 10 });
    expect(flipped[2]).toEqual({ x: 0, y: 30 });
  });

  it('mirrors y around points[0].y when vertical', () => {
    const flipped = flipPoints(shape, { vertical: true });
    expect(flipped[1]).toEqual({ x: 20, y: 10 }); // same y as pivot, unchanged
    expect(flipped[2]).toEqual({ x: 20, y: -10 }); // y=30 is +20 from pivot(10), mirrors to -10
  });

  it('flipping twice on the same axis returns the original shape', () => {
    const twice = flipPoints(flipPoints(shape, { horizontal: true }), { horizontal: true });
    expect(twice).toEqual(shape);
  });
});

describe('translatePointsTo', () => {
  it('moves points[0] exactly onto the anchor', () => {
    const translated = translatePointsTo(shape, { x: 100, y: 50 });
    expect(translated[0]).toEqual({ x: 100, y: 50 });
  });

  it('preserves the shape (relative offsets)', () => {
    const translated = translatePointsTo(shape, { x: 0, y: 0 });
    expect(translated[1].sub(translated[0])).toEqual({ x: 10, y: 0 });
    expect(translated[2].sub(translated[0])).toEqual({ x: 10, y: 20 });
  });

  it('does not mutate the input array', () => {
    translatePointsTo(shape, { x: 500, y: 500 });
    expect(shape[0]).toEqual({ x: 10, y: 10 });
  });
});
