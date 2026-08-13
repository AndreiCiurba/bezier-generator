import { describe, it, expect } from 'vitest';
import { CATEGORY_LEAD_COLORS, leadColorForIndex } from './categoryLeadColors.js';

describe('CATEGORY_LEAD_COLORS', () => {
  it('has one well-formed hex per category (19 categories)', () => {
    expect(CATEGORY_LEAD_COLORS).toHaveLength(19);
    for (const hex of CATEGORY_LEAD_COLORS) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('leadColorForIndex', () => {
  it('returns the Nth category lead color for index N within range', () => {
    expect(leadColorForIndex(0)).toBe(CATEGORY_LEAD_COLORS[0]);
    expect(leadColorForIndex(7)).toBe(CATEGORY_LEAD_COLORS[7]);
    expect(leadColorForIndex(18)).toBe(CATEGORY_LEAD_COLORS[18]);
  });

  it('cycles back to the first category once the index exceeds the category count', () => {
    expect(leadColorForIndex(19)).toBe(CATEGORY_LEAD_COLORS[0]);
    expect(leadColorForIndex(20)).toBe(CATEGORY_LEAD_COLORS[1]);
    expect(leadColorForIndex(37)).toBe(CATEGORY_LEAD_COLORS[18]);
    expect(leadColorForIndex(38)).toBe(CATEGORY_LEAD_COLORS[0]);
  });
});
