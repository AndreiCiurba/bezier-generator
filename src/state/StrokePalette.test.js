import { describe, it, expect } from 'vitest';
import { StrokePalette } from './StrokePalette.js';

describe('StrokePalette', () => {
  it('starts with 8 default slots, all enabled', () => {
    const palette = new StrokePalette();
    expect(palette.size).toBe(8);
    expect(palette.getAll().every((s) => s.enabled)).toBe(true);
  });

  it('setColor changes only the targeted slot', () => {
    const palette = new StrokePalette();
    palette.setColor(2, '#123456');
    expect(palette.getSlot(2).color).toBe('#123456');
    expect(palette.getSlot(0).color).not.toBe('#123456');
  });

  it('toggleEnabled flips and returns the new state', () => {
    const palette = new StrokePalette();
    expect(palette.toggleEnabled(0)).toBe(false);
    expect(palette.getSlot(0).enabled).toBe(false);
    expect(palette.toggleEnabled(0)).toBe(true);
  });

  it('getEnabledColors excludes disabled slots', () => {
    const palette = new StrokePalette(['#a', '#b', '#c']);
    palette.toggleEnabled(1);
    expect(palette.getEnabledColors()).toEqual(['#a', '#c']);
  });

  it('snapshot is a deep clone, not a live reference', () => {
    const palette = new StrokePalette(['#a']);
    const snap = palette.snapshot();
    palette.setColor(0, '#b');
    expect(snap[0].color).toBe('#a');
  });
});
