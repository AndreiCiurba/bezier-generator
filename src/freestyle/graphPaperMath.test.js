import { describe, it, expect } from 'vitest';
import { computeDivisions, computeGridLines } from './graphPaperMath.js';

describe('computeDivisions', () => {
  it('uses 100x100 for a square canvas', () => {
    expect(computeDivisions(709, 709)).toEqual({ cols: 100, rows: 100 });
  });

  it('reduces the shorter axis proportionally for a 2:1 wide rectangle', () => {
    expect(computeDivisions(200, 100)).toEqual({ cols: 100, rows: 50 });
  });

  it('reduces the shorter axis proportionally for the reverse (tall) case', () => {
    expect(computeDivisions(100, 200)).toEqual({ cols: 50, rows: 100 });
  });

  it('keeps cells square: cell width equals cell height', () => {
    // A 4:1 ratio divides 100 evenly (unlike e.g. 3:1), so this isolates the
    // "cells stay square" claim from separate, expected rounding error.
    const { cols, rows } = computeDivisions(400, 100);
    expect(400 / cols).toBe(100 / rows);
  });

  it('never returns zero divisions on the short axis, even for an extreme ratio', () => {
    const { rows } = computeDivisions(10000, 1);
    expect(rows).toBeGreaterThanOrEqual(1);
  });

  it('returns a zero/zero box for a degenerate (zero or negative) size', () => {
    expect(computeDivisions(0, 100)).toEqual({ cols: 0, rows: 0 });
  });
});

describe('computeGridLines', () => {
  it('returns divisions+1 lines spanning exactly [0, length]', () => {
    const lines = computeGridLines(10, 100);
    expect(lines).toHaveLength(11);
    expect(lines[0].position).toBe(0);
    expect(lines[10].position).toBe(100);
  });

  it('marks every 10th line, starting from 0, as major', () => {
    const lines = computeGridLines(100, 1000);
    const majors = lines.filter((l) => l.major).map((l) => l.position);
    expect(majors).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
  });

  it('everything else is minor', () => {
    const lines = computeGridLines(10, 100);
    const minors = lines.filter((l) => !l.major);
    expect(minors).toHaveLength(9);
  });

  it('returns an empty array for zero (or fewer) divisions rather than dividing by zero', () => {
    expect(computeGridLines(0, 100)).toEqual([]);
  });
});
