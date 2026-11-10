import { describe, it, expect } from 'vitest';
import { circleNailPositions, layerChords, parallelStrings, wrapArc } from './cardioidWeave.js';

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

describe('parallelStrings', () => {
  it('returns two parallel strings whose gap is exactly the nail thickness', () => {
    const [a, b] = parallelStrings({ x: 0, y: 0 }, { x: 100, y: 0 }, 10);
    expect(a.from.y - b.from.y).toBeCloseTo(10);
    expect(a.to.y - b.to.y).toBeCloseTo(10);
    expect(a.from.x).toBeCloseTo(0);
    expect(a.to.x).toBeCloseTo(100);
  });

  it('keeps the gap equal to the thickness on a diagonal chord, not just an axis-aligned one', () => {
    const [a, b] = parallelStrings({ x: 0, y: 0 }, { x: 30, y: 40 }, 10);
    expect(Math.hypot(a.from.x - b.from.x, a.from.y - b.from.y)).toBeCloseTo(10);
    expect(Math.hypot(a.to.x - b.to.x, a.to.y - b.to.y)).toBeCloseTo(10);
  });

  it('falls back to the single center line when there is no thickness to wrap around', () => {
    expect(parallelStrings({ x: 0, y: 0 }, { x: 5, y: 5 }, 0)).toHaveLength(1);
  });
});

describe('wrapArc', () => {
  const center = { x: 10, y: 20 };

  it('keeps every point on the circle of the nail', () => {
    const arc = wrapArc(center, 5, [{ x: 1, y: 0 }, { x: 0, y: 1 }]);
    for (const p of arc) expect(Math.hypot(p.x - center.x, p.y - center.y)).toBeCloseTo(5);
  });

  it('wraps the back of a nail with a single string: a half turn on the side away from the string', () => {
    const arc = wrapArc(center, 5, [{ x: 1, y: 0 }]); // string leaves to the right
    expect(arc.length).toBeGreaterThan(2);
    for (const p of arc) expect(p.x).toBeLessThanOrEqual(center.x + 1e-9); // never the string's side
    const first = arc[0];
    const last = arc[arc.length - 1];
    expect(Math.hypot(first.x - last.x, first.y - last.y)).toBeCloseTo(10); // ends are diametrically opposite
  });

  it('has nothing to draw for a zero radius or no strings', () => {
    expect(wrapArc(center, 0, [{ x: 1, y: 0 }])).toEqual([]);
    expect(wrapArc(center, 5, [])).toEqual([]);
  });
});
