import { describe, it, expect } from 'vitest';
import { defaultRun, normalizeRun, fitRunToNailCount, runsFromLegacy } from './cardioidRun.js';

describe('normalizeRun', () => {
  it('fills missing fields with a full, unturned run on the shared multiplier and leap', () => {
    expect(normalizeRun({}, 48)).toEqual({ ...defaultRun(48), color: expect.any(String) });
  });

  it('clamps thread numbers onto the board and treats a non-whole override as "use the shared one"', () => {
    const run = normalizeRun({ rangeStart: 0, rangeEnd: 99, multiplier: 2.5, leap: 3 }, 48);
    expect(run).toMatchObject({ rangeStart: 1, rangeEnd: 48, multiplier: null, leap: 3 });
  });
});

describe('fitRunToNailCount', () => {
  it('keeps a full run full when the nail count changes, so the default run never shrinks to a part', () => {
    expect(fitRunToNailCount(defaultRun(48), 48, 60)).toMatchObject({ rangeStart: 1, rangeEnd: 60 });
  });

  it('clips a part run to the new nail count', () => {
    expect(fitRunToNailCount({ ...defaultRun(48), rangeStart: 30, rangeEnd: 40 }, 48, 36)).toMatchObject({ rangeStart: 30, rangeEnd: 36 });
  });
});

describe('runsFromLegacy', () => {
  const colors = [{ color: '#a', enabled: true }, { color: '#b', enabled: true }];

  it('splits an old full two-color cardioid into its two color halves', () => {
    expect(runsFromLegacy({ nailCount: 48, colors }).map((r) => [r.color, r.rangeStart, r.rangeEnd])).toEqual([['#a', 1, 23], ['#b', 24, 47]]);
  });

  it('only counts enabled colors, like the old weave did', () => {
    const runs = runsFromLegacy({ nailCount: 48, colors: [colors[0], { color: '#b', enabled: false }] });
    expect(runs.map((r) => [r.color, r.rangeStart, r.rangeEnd])).toEqual([['#a', 1, 47]]);
  });

  it('has nothing to weave when every color was off', () => {
    expect(runsFromLegacy({ nailCount: 48, colors: [{ color: '#a', enabled: false }] })).toEqual([]);
  });
});
