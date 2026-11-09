import { describe, it, expect } from 'vitest';
import { circleNailPositions, layerChords, layerWeight } from './cardioidWeave.js';

const base = { nailCount: 12, multiplier: 2, leap: 1, layerIndex: 0, colorCount: 2 };

describe('circleNailPositions', () => {
  it('places every nail on the circle, with nail 0 at the top of the board', () => {
    const nails = circleNailPositions(8, 100);
    expect(nails).toHaveLength(8);
    expect(nails[0].x).toBeCloseTo(0);
    expect(nails[0].y).toBeCloseTo(-100);
    for (const n of nails) expect(Math.hypot(n.x, n.y)).toBeCloseTo(100);
  });
});

describe('layerChords', () => {
  it('joins nail j to nail 2j on the bottom layer (the cardioid times table)', () => {
    const chords = layerChords(base);
    expect(chords.find((c) => c.fromIndex === 3)).toMatchObject({ toIndex: 6 });
    expect(chords.find((c) => c.fromIndex === 7)).toMatchObject({ toIndex: 2 }); // 14 wraps to 2
  });

  it('drops chords that would join a nail to itself, since there is nothing to draw', () => {
    const chords = layerChords(base);
    expect(chords.every((c) => c.fromIndex !== c.toIndex)).toBe(true);
    expect(chords.find((c) => c.fromIndex === 0)).toBeUndefined(); // 0 -> 0
  });

  it('splits the start nails into two halves by default: first half color 0, second half color 1', () => {
    const chords = layerChords(base);
    for (const c of chords) expect(c.colorIndex).toBe(c.fromIndex < 6 ? 0 : 1);
  });

  it('splits into thirds with three colors', () => {
    const chords = layerChords({ ...base, colorCount: 3 });
    for (const c of chords) expect(c.colorIndex).toBe(Math.floor(c.fromIndex / 4));
  });

  it('starts layer k at nail k * leap, rotating the whole pattern (including where the colors split)', () => {
    const rotated = layerChords({ ...base, layerIndex: 2, leap: 3 }); // start nail 6
    const original = layerChords(base);
    const shifted = original.map((c) => ({ ...c, fromIndex: (c.fromIndex + 6) % 12, toIndex: (c.toIndex + 6) % 12 }));
    const key = (c) => `${c.fromIndex}-${c.toIndex}-${c.colorIndex}`;
    expect(new Set(rotated.map(key))).toEqual(new Set(shifted.map(key)));
  });

  it('stacks identical layers when leap is 0', () => {
    expect(layerChords({ ...base, leap: 0, layerIndex: 4 })).toEqual(layerChords({ ...base, leap: 0, layerIndex: 0 }));
  });

  it('supports other multipliers, e.g. 3 for a nephroid', () => {
    expect(layerChords({ ...base, multiplier: 3 }).find((c) => c.fromIndex === 2)).toMatchObject({ toIndex: 6 });
  });
});

describe('layerWeight', () => {
  it('is thickest on the bottom layer and tapers linearly to the thinnest on the top one', () => {
    expect(layerWeight(0, 5, 1, 0.2)).toBeCloseTo(1);
    expect(layerWeight(2, 5, 1, 0.2)).toBeCloseTo(0.6);
    expect(layerWeight(4, 5, 1, 0.2)).toBeCloseTo(0.2);
  });

  it('uses the bottom weight when there is only one layer', () => {
    expect(layerWeight(0, 1, 0.9, 0.1)).toBe(0.9);
  });
});
