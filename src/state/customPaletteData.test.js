import { describe, it, expect } from 'vitest';
import { groupByCategory } from './customPaletteData.js';
import customPaletteFixture from '../data/customPalette.json';

describe('groupByCategory', () => {
  it('groups records under their category, preserving first-seen category order', () => {
    const records = [
      { category: 'B', subcategory: '', hex: '#111111' },
      { category: 'A', subcategory: '', hex: '#222222' },
      { category: 'B', subcategory: '', hex: '#333333' },
    ];
    const grouped = groupByCategory(records);
    expect(grouped.map((g) => g.category)).toEqual(['B', 'A']);
  });

  it('preserves each category\'s internal (source) record order', () => {
    const records = [
      { category: 'A', subcategory: '', hex: '#111111' },
      { category: 'A', subcategory: '', hex: '#222222' },
      { category: 'A', subcategory: '', hex: '#333333' },
    ];
    const grouped = groupByCategory(records);
    expect(grouped[0].colors.map((c) => c.hex)).toEqual(['#111111', '#222222', '#333333']);
  });

  it('returns an empty array for no records', () => {
    expect(groupByCategory([])).toEqual([]);
  });

  it('groups the real customPalette.json into the expected 19 categories with no colors dropped', () => {
    const grouped = groupByCategory(customPaletteFixture);
    const totalColors = grouped.reduce((sum, g) => sum + g.colors.length, 0);
    expect(grouped).toHaveLength(19);
    expect(totalColors).toBe(customPaletteFixture.length);
    expect(totalColors).toBe(205);
  });

  it('every color in the real dataset has a well-formed hex', () => {
    const grouped = groupByCategory(customPaletteFixture);
    for (const { colors } of grouped) {
      for (const { hex } of colors) {
        expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });
});
