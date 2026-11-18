import { describe, it, expect } from 'vitest';
import { circleNailPositions, ellipseNailPositions, layerChords, threadInRange, wrapArc } from './cardioidWeave.js';

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

describe('ellipseNailPositions', () => {
  it('matches the circle at stretch 1, so a plain cardioid is unchanged', () => {
    expect(ellipseNailPositions(8, 100)).toEqual(circleNailPositions(8, 100));
  });

  it('widens the board sideways by the stretch factor while keeping the height', () => {
    const nails = ellipseNailPositions(4, 100, { stretch: 2 });
    expect(nails[1].x).toBeCloseTo(200); // a quarter turn from the top, on the side
    expect(nails[2].y).toBeCloseTo(100); // the bottom, unstretched
  });

  it('numbers the nails the other way round when counting counter-clockwise', () => {
    const cw = ellipseNailPositions(4, 100);
    const ccw = ellipseNailPositions(4, 100, { direction: 'ccw' });
    expect(ccw[1].x).toBeCloseTo(-cw[1].x);
    expect(ccw[0].y).toBeCloseTo(cw[0].y); // same starting nail
  });
});

describe('visible thread range', () => {
  const half = { nailCount: 48, multiplier: 2, leap: 0, layerIndex: 0, colorCount: 1 };

  it('keeps threads 1-2 .. 24-48 for range 1-24 of 48: half a cardioid', () => {
    const chords = layerChords({ ...half, range: { start: 1, end: 24 } });
    expect(chords.map((c) => c.fromIndex)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    expect(chords.at(-1)).toMatchObject({ fromIndex: 24, toIndex: 0 }); // 24 -> 48, nail 48 being nail 0
  });

  it('keeps threads 25-2 .. 36-24 for range 25-36: the third quarter', () => {
    const chords = layerChords({ ...half, range: { start: 25, end: 36 } });
    expect(chords[0]).toMatchObject({ fromIndex: 25, toIndex: 2 });
    expect(chords.at(-1)).toMatchObject({ fromIndex: 36, toIndex: 24 });
    expect(chords).toHaveLength(12);
  });

  it('wraps past the last nail when start is after end', () => {
    expect(threadInRange(47, 48, { start: 40, end: 5 })).toBe(true);
    expect(threadInRange(0, 48, { start: 40, end: 5 })).toBe(true); // thread 48
    expect(threadInRange(3, 48, { start: 40, end: 5 })).toBe(true);
    expect(threadInRange(20, 48, { start: 40, end: 5 })).toBe(false);
  });

  it('keeps each thread its color when others are hidden, so a part cardioid matches the full one', () => {
    const full = layerChords({ ...half, colorCount: 2 });
    const part = layerChords({ ...half, colorCount: 2, range: { start: 20, end: 30 } });
    for (const c of part) expect(c.colorIndex).toBe(full.find((f) => f.fromIndex === c.fromIndex).colorIndex);
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
