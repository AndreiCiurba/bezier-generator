import { describe, it, expect } from 'vitest';
import { toPixels, parseSize, parseToPixels, DEFAULT_DPI } from './units.js';

describe('toPixels', () => {
  it('passes px through unchanged', () => {
    expect(toPixels(600, 'px', 96)).toBe(600);
  });

  it('converts inches directly by DPI', () => {
    expect(toPixels(2, 'in', 96)).toBe(192);
  });

  it('converts cm via inches', () => {
    expect(toPixels(2.54, 'cm', 96)).toBeCloseTo(96, 5);
  });

  it('converts mm via inches', () => {
    expect(toPixels(25.4, 'mm', 96)).toBeCloseTo(96, 5);
  });

  it('a higher DPI yields more pixels for the same physical size', () => {
    expect(toPixels(1, 'in', 300)).toBeGreaterThan(toPixels(1, 'in', 96));
  });
});

describe('parseSize', () => {
  it('parses a bare number as px', () => {
    expect(parseSize('600')).toEqual({ value: 600, unit: 'px' });
  });

  it('parses value+unit, case-insensitively, with optional space', () => {
    expect(parseSize('20cm')).toEqual({ value: 20, unit: 'cm' });
    expect(parseSize('20 CM')).toEqual({ value: 20, unit: 'cm' });
    expect(parseSize('4.5in')).toEqual({ value: 4.5, unit: 'in' });
  });

  it('returns null for garbage input', () => {
    expect(parseSize('abc')).toBeNull();
    expect(parseSize('')).toBeNull();
    expect(parseSize('20 furlongs')).toBeNull();
  });
});

describe('parseToPixels', () => {
  it('parses and converts in one step', () => {
    expect(parseToPixels('1in', 96)).toBe(96);
  });

  it('rejects zero/negative sizes', () => {
    expect(parseToPixels('0cm', 96)).toBeNull();
    expect(parseToPixels('-5px', 96)).toBeNull();
  });

  it('rejects unparseable input', () => {
    expect(parseToPixels('nope', 96)).toBeNull();
  });
});

describe('DEFAULT_DPI', () => {
  it('is 90 (the freestyle page default starting DPI)', () => {
    expect(DEFAULT_DPI).toBe(90);
  });
});
