import { describe, it, expect } from 'vitest';
import { parsePinRadius, parsePinFalloff, MIN_PIN_RADIUS, MAX_PIN_RADIUS, MIN_PIN_FALLOFF, MAX_PIN_FALLOFF } from './pinParams.js';

describe('parsePinRadius', () => {
  it('accepts a value within range', () => {
    expect(parsePinRadius('180')).toBe(180);
    expect(parsePinRadius(50.5)).toBe(50.5);
  });

  it('rejects non-numeric input', () => {
    expect(parsePinRadius('abc')).toBeNull();
    expect(parsePinRadius('')).toBeNull();
  });

  it('rejects out-of-range input', () => {
    expect(parsePinRadius(MIN_PIN_RADIUS - 1)).toBeNull();
    expect(parsePinRadius(MAX_PIN_RADIUS + 1)).toBeNull();
  });

  it('accepts the boundary values', () => {
    expect(parsePinRadius(MIN_PIN_RADIUS)).toBe(MIN_PIN_RADIUS);
    expect(parsePinRadius(MAX_PIN_RADIUS)).toBe(MAX_PIN_RADIUS);
  });
});

describe('parsePinFalloff', () => {
  it('accepts a value within range', () => {
    expect(parsePinFalloff('1')).toBe(1);
    expect(parsePinFalloff(2.5)).toBe(2.5);
  });

  it('rejects non-numeric or out-of-range input', () => {
    expect(parsePinFalloff('xyz')).toBeNull();
    expect(parsePinFalloff(MIN_PIN_FALLOFF - 0.05)).toBeNull();
    expect(parsePinFalloff(MAX_PIN_FALLOFF + 1)).toBeNull();
  });
});
