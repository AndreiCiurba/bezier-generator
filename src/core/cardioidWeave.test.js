import { describe, it, expect } from 'vitest';
import { circleNailPositions, ellipseNailPositions, runChords, stackChords, stackDepth, threadInRange, wrapArc } from './cardioidWeave.js';

describe('circleNailPositions', () => {
  it('places every nail on the circle, with nail 0 at the top of the board', () => {
    const nails = circleNailPositions(8, 100);
    expect(nails).toHaveLength(8);
    expect(nails[0].x).toBeCloseTo(0);
    expect(nails[0].y).toBeCloseTo(-100);
    for (const n of nails) expect(Math.hypot(n.x, n.y)).toBeCloseTo(100);
  });
});

const base = { nailCount: 12, multiplier: 2, leap: 1, layerIndex: 0 };

describe('runChords', () => {
  it('joins nail j to nail 2j on the bottom layer (the cardioid times table)', () => {
    const chords = runChords(base);
    expect(chords.find((c) => c.fromIndex === 3)).toMatchObject({ toIndex: 6 });
    expect(chords.find((c) => c.fromIndex === 7)).toMatchObject({ toIndex: 2 }); // 14 wraps to 2
  });

  it('drops chords that would join a nail to itself, since there is nothing to draw', () => {
    const chords = runChords(base);
    expect(chords.every((c) => c.fromIndex !== c.toIndex)).toBe(true);
    expect(chords.find((c) => c.fromIndex === 0)).toBeUndefined(); // 0 -> 0
  });

  it('starts layer k at nail k * leap, rotating the whole pattern', () => {
    const rotated = runChords({ ...base, layerIndex: 2, leap: 3 }); // start nail 6
    const shifted = runChords(base).map((c) => ({ ...c, fromIndex: (c.fromIndex + 6) % 12, toIndex: (c.toIndex + 6) % 12 }));
    expect(rotated).toEqual(shifted);
  });

  it('stacks identical layers when leap is 0', () => {
    expect(runChords({ ...base, leap: 0, layerIndex: 4 })).toEqual(runChords({ ...base, leap: 0, layerIndex: 0 }));
  });

  it('supports other multipliers, e.g. 3 for a nephroid', () => {
    expect(runChords({ ...base, multiplier: 3 }).find((c) => c.fromIndex === 2)).toMatchObject({ toIndex: 6 });
  });

  it('marks only the last chord single, because the thread ends there going one way', () => {
    const chords = runChords(base);
    expect(chords.filter((c) => c.single)).toEqual([chords.at(-1)]);
  });
});

describe('run ranges and turns (part cardioids)', () => {
  const half = { nailCount: 48, multiplier: 2, leap: 0, layerIndex: 0 };
  const pairs = (chords) => chords.map((c) => `${c.fromIndex || 48}-${c.toIndex || 48}`);

  it('weaves 1-2 .. 24-48 for threads 1-24 of 48: half a cardioid', () => {
    const chords = runChords({ ...half, range: { start: 1, end: 24 } });
    expect(chords.map((c) => c.fromIndex)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    expect(chords.at(-1)).toMatchObject({ fromIndex: 24, toIndex: 0, single: true });
  });

  it('weaves 24-48, 25-2 .. 47-46 for threads 24-47: the hugging other half', () => {
    const p = pairs(runChords({ ...half, range: { start: 24, end: 47 } }));
    expect(p.slice(0, 2)).toEqual(['24-48', '25-2']);
    expect(p.slice(-2)).toEqual(['46-44', '47-46']);
  });

  it('turns a run by its rotation, giving the three nephroid runs 1-3.., 17-19.., 33-35.. 38-2', () => {
    const run = (rotation) => pairs(runChords({ ...half, multiplier: 3, rotation, range: { start: 1, end: 6 } }));
    expect(run(0)).toEqual(['1-3', '2-6', '3-9', '4-12', '5-15', '6-18']);
    expect(run(16)).toEqual(['17-19', '18-22', '19-25', '20-28', '21-31', '22-34']);
    expect(run(32)).toEqual(['33-35', '34-38', '35-41', '36-44', '37-47', '38-2']);
  });

  it('strings a range that wraps past the last nail in order, from its start round to its end', () => {
    const chords = runChords({ ...half, range: { start: 46, end: 2 } });
    expect(chords.map((c) => c.thread)).toEqual([46, 47, 1, 2]); // 48 joins nail 0 to itself
  });

  it('still says which threads are inside a wrapping range', () => {
    expect(threadInRange(47, 48, { start: 40, end: 5 })).toBe(true);
    expect(threadInRange(0, 48, { start: 40, end: 5 })).toBe(true); // thread 48
    expect(threadInRange(20, 48, { start: 40, end: 5 })).toBe(false);
  });
});

describe('stackChords', () => {
  const run = (changes) => ({ color: '#a', enabled: true, rangeStart: 1, rangeEnd: 6, rotation: 0, multiplier: null, leap: null, ...changes });
  const params = { nailCount: 48, layerCount: 2, leap: 5, multiplier: 3 };

  it('gives each run of a layer its own stack slot, in list order, so the first run lies lowest', () => {
    const chords = stackChords({ ...params, runs: [run({ color: '#a' }), run({ color: '#b', rotation: 16 })] });
    expect(new Set(chords.filter((c) => c.color === '#a').map((c) => c.stackIndex))).toEqual(new Set([0]));
    expect(new Set(chords.filter((c) => c.color === '#b').map((c) => c.stackIndex))).toEqual(new Set([1]));
  });

  it('skips hidden runs without leaving a gap in the stack', () => {
    const chords = stackChords({ ...params, runs: [run({ enabled: false }), run({ color: '#b' })] });
    expect(chords.every((c) => c.color === '#b' && c.stackIndex === 0 && c.runIndex === 1)).toBe(true);
    expect(stackDepth([run({ enabled: false }), run()])).toBe(1);
  });

  it('uses the shared multiplier and leap unless a run has its own, so epicycloids can be mixed', () => {
    const chords = stackChords({ ...params, runs: [run({ multiplier: 2, leap: 0 })] });
    const layer1 = chords.filter((c) => c.layerIndex === 1);
    expect(layer1[0]).toMatchObject({ fromIndex: 1, toIndex: 2 }); // own multiplier 2, own leap 0: not turned
    const shared = stackChords({ ...params, runs: [run()] }).filter((c) => c.layerIndex === 1);
    expect(shared[0]).toMatchObject({ fromIndex: 6, toIndex: 8 }); // shared leap 5, multiplier 3
  });

  it('repeats the whole stack on every layer', () => {
    const chords = stackChords({ ...params, runs: [run(), run({ rotation: 16 })] });
    expect(chords.filter((c) => c.layerIndex === 0)).toHaveLength(12);
    expect(chords.filter((c) => c.layerIndex === 1)).toHaveLength(12);
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
