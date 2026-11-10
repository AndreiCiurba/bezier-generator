import { describe, it, expect } from 'vitest';
import { layerStep, findLeapProblems, suggestLeap } from './leapCheck.js';

const on = (n) => Array(n).fill(true);

describe('findLeapProblems', () => {
  it('accepts 20 nails and 10 colors at leap -2: steps -1..-10 are all different and nonzero', () => {
    expect(findLeapProblems({ nailCount: 20, leap: -2, enabled: on(10) })).toEqual([]);
  });

  it('also accepts leap 9 for the same shape (steps 10..1, widest layer first)', () => {
    expect(findLeapProblems({ nailCount: 20, leap: 9, enabled: on(10) })).toEqual([]);
  });

  it('flags the layer whose step is 0 as empty, and the layer mirroring an earlier one as a duplicate (leap 0)', () => {
    const problems = findLeapProblems({ nailCount: 20, leap: 0, enabled: on(10) });
    expect(problems).toContainEqual({ kind: 'empty', layer: 1 }); // step 0
    expect(problems).toContainEqual({ kind: 'duplicate', layer: 2, of: 0 }); // step -1 draws what step 1 draws
  });

  it('treats a step of a whole lap as empty too, not just 0', () => {
    // leap 19 on 20 nails: layer 0 has step 20.
    expect(findLeapProblems({ nailCount: 20, leap: 19, enabled: on(1) })).toEqual([{ kind: 'empty', layer: 0 }]);
  });

  it('cannot fit 10 or 11 colors on 12 nails: only 6 different layers exist', () => {
    expect(findLeapProblems({ nailCount: 12, leap: 4, enabled: on(11) }).length).toBeGreaterThan(0);
  });

  it('ignores layers that are switched off', () => {
    const enabled = [true, false, true];
    // leap 0: steps 1, (0 skipped because off), -1 -> duplicate of layer 0
    expect(findLeapProblems({ nailCount: 20, leap: 0, enabled })).toEqual([{ kind: 'duplicate', layer: 2, of: 0 }]);
  });
});

describe('suggestLeap', () => {
  it('keeps the current leap when it already works', () => {
    expect(suggestLeap({ nailCount: 20, leap: -2, enabled: on(10) })).toBe(-2);
  });

  it('moves to the nearest working leap', () => {
    const leap = suggestLeap({ nailCount: 20, leap: 0, enabled: on(10) });
    expect(findLeapProblems({ nailCount: 20, leap, enabled: on(10) })).toEqual([]);
    expect(Math.abs(leap)).toBeLessThanOrEqual(9);
  });

  it('returns null when the nails cannot fit the layers (needs nails >= 2 x colors)', () => {
    expect(suggestLeap({ nailCount: 12, leap: 0, enabled: on(11) })).toBeNull();
    expect(suggestLeap({ nailCount: 21, leap: 0, enabled: on(11) })).toBeNull(); // 21 nails -> only 10 distinct layers
  });
});

describe('layerStep', () => {
  it('starts at 1 + leap and drops by one per layer', () => {
    expect([0, 1, 2].map((i) => layerStep(0, i))).toEqual([1, 0, -1]);
  });
});
