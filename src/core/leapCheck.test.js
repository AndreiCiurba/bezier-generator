import { describe, it, expect } from 'vitest';
import { layerStep, findLeapProblems, suggestLeap } from './leapCheck.js';

const on = (n) => Array(n).fill(true);

describe('findLeapProblems (center-out rule, the default)', () => {
  it('shows all 10 layers of a 20-nail shape at leap 0: steps 10..19 all fold to different non-zero chords', () => {
    expect(findLeapProblems({ nailCount: 20, leap: 0, enabled: on(10) })).toEqual([]);
  });

  it('flags a layer whose step reaches a whole lap as empty (20 nails, leap 10: layer 0 steps 20)', () => {
    expect(findLeapProblems({ nailCount: 20, leap: 10, enabled: on(1) })).toEqual([{ kind: 'empty', layer: 0 }]);
  });

  it('flags a layer that mirrors an earlier one when the stack crosses back over the half-way chord', () => {
    // leap -1 on 20 nails: steps 9, 10, 11 -> 11 mirrors 9.
    expect(findLeapProblems({ nailCount: 20, leap: -1, enabled: on(3) })).toEqual([{ kind: 'duplicate', layer: 2, of: 0 }]);
  });

  it('cannot fit 11 colors on 20 nails: only 10 different layers exist', () => {
    expect(findLeapProblems({ nailCount: 20, leap: 0, enabled: on(11) }).length).toBeGreaterThan(0);
  });

  it('on an odd ring the first two layers mirror at leap 0, so leap 1 is needed', () => {
    expect(findLeapProblems({ nailCount: 21, leap: 0, enabled: on(2) })).toEqual([{ kind: 'duplicate', layer: 1, of: 0 }]);
    expect(findLeapProblems({ nailCount: 21, leap: 1, enabled: on(10) })).toEqual([]);
  });

  it('ignores layers that are switched off', () => {
    expect(findLeapProblems({ nailCount: 21, leap: 0, enabled: [true, false] })).toEqual([]);
  });
});

describe('findLeapProblems (legacy rule, shapes saved before center-out)', () => {
  it('accepts 20 nails and 10 colors at leap -2 and 9, but not at leap 0', () => {
    expect(findLeapProblems({ nailCount: 20, leap: -2, enabled: on(10), rule: 'legacy' })).toEqual([]);
    expect(findLeapProblems({ nailCount: 20, leap: 9, enabled: on(10), rule: 'legacy' })).toEqual([]);
    const problems = findLeapProblems({ nailCount: 20, leap: 0, enabled: on(10), rule: 'legacy' });
    expect(problems).toContainEqual({ kind: 'empty', layer: 1 });
    expect(problems).toContainEqual({ kind: 'duplicate', layer: 2, of: 0 });
  });
});

describe('suggestLeap', () => {
  it('keeps the current leap when it already works', () => {
    expect(suggestLeap({ nailCount: 20, leap: 0, enabled: on(10) })).toBe(0);
  });

  it('moves to the nearest working leap', () => {
    const leap = suggestLeap({ nailCount: 20, leap: 5, enabled: on(10) });
    expect(findLeapProblems({ nailCount: 20, leap, enabled: on(10) })).toEqual([]);
    expect(leap).toBe(0);
  });

  it('returns null when the nails cannot fit the layers (needs nails >= 2 x colors)', () => {
    expect(suggestLeap({ nailCount: 12, leap: 0, enabled: on(11) })).toBeNull();
    expect(suggestLeap({ nailCount: 21, leap: 0, enabled: on(11) })).toBeNull(); // 21 nails -> only 10 distinct layers
  });
});

describe('layerStep', () => {
  it('center-out: starts at half the nails plus leap and climbs by one per layer', () => {
    expect([0, 1, 2].map((i) => layerStep(0, i, 20))).toEqual([10, 11, 12]);
    expect([0, 1].map((i) => layerStep(2, i, 21))).toEqual([12, 13]);
  });

  it('legacy: starts at 1 + leap and drops by one per layer', () => {
    expect([0, 1, 2].map((i) => layerStep(0, i, 20, 'legacy'))).toEqual([1, 0, -1]);
  });
});
