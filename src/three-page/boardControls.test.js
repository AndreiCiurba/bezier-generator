import { describe, it, expect } from 'vitest';
import {
  parseBoardThickness,
  parseBoardColor,
  MIN_BOARD_THICKNESS,
  MAX_BOARD_THICKNESS,
} from './boardControls.js';

describe('parseBoardThickness', () => {
  it('accepts values within [MIN_BOARD_THICKNESS, MAX_BOARD_THICKNESS]', () => {
    expect(parseBoardThickness(MIN_BOARD_THICKNESS)).toBe(MIN_BOARD_THICKNESS);
    expect(parseBoardThickness(MAX_BOARD_THICKNESS)).toBe(MAX_BOARD_THICKNESS);
    expect(parseBoardThickness('20')).toBe(20);
  });

  it('rejects out-of-range or non-numeric input', () => {
    expect(parseBoardThickness(MIN_BOARD_THICKNESS - 1)).toBeNull();
    expect(parseBoardThickness(MAX_BOARD_THICKNESS + 1)).toBeNull();
    expect(parseBoardThickness('abc')).toBeNull();
    expect(parseBoardThickness('')).toBeNull();
  });
});

describe('parseBoardColor', () => {
  it('accepts 6-digit and 3-digit hex colors, case-insensitively', () => {
    expect(parseBoardColor('#8a784e')).toBe('#8a784e');
    expect(parseBoardColor('#FFF')).toBe('#FFF');
  });

  it('rejects anything that is not a valid hex color string', () => {
    expect(parseBoardColor('red')).toBeNull();
    expect(parseBoardColor('8a784e')).toBeNull(); // missing '#'
    expect(parseBoardColor('#12345')).toBeNull(); // wrong length
    expect(parseBoardColor(123)).toBeNull();
    expect(parseBoardColor(null)).toBeNull();
  });
});
