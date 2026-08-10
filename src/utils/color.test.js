import { describe, it, expect } from 'vitest';
import { randomHexColor } from './color.js';

describe('randomHexColor', () => {
  it('returns a well-formed 6-digit hex color', () => {
    expect(randomHexColor()).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('varies across calls (not a constant)', () => {
    const samples = new Set(Array.from({ length: 20 }, () => randomHexColor()));
    // Astronomically unlikely to collide 20 times in a row out of 16.7M values
    // unless something is actually constant/broken.
    expect(samples.size).toBeGreaterThan(1);
  });
});
