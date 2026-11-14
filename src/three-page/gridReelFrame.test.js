import { describe, it, expect } from 'vitest';
import { prepareGrid, resolveGridFrame } from './gridReelFrame.js';

const recipe = (extra = {}) => ({ grid: { size: 7, shape: 'hexagon', spacing: 100 }, weave: { inner: 1, layers: 2, palette: ['#ff0000', '#0000ff'] }, ...extra });

describe('prepareGrid', () => {
  it('finds the lattice cells and centers the lattice on the board', () => {
    const prepared = prepareGrid(recipe());
    expect(prepared.cells.length).toBeGreaterThan(0);
    expect(prepared.cells.every((cell) => cell.length === 6)).toBe(true);
    const xs = prepared.base.map((p) => p.x);
    expect(Math.min(...xs) + Math.max(...xs)).toBeCloseTo(0);
  });

  it('works for every grid shape the /3d page offers', () => {
    for (const shape of ['triangle', 'square', 'hexagon']) {
      expect(prepareGrid(recipe({ grid: { size: 5, shape, spacing: 100 } })).cells.length).toBeGreaterThan(0);
    }
  });
});

describe('resolveGridFrame', () => {
  it('strings the center cells first in center order', () => {
    const r = recipe({ weave: { inner: 1, layers: 1, palette: ['#fff'], order: 'center', softness: 0.05, drawProgress: 0.3 } });
    const prepared = prepareGrid(r);
    const frame = resolveGridFrame(r, 0, prepared);
    const reach = Math.max(...frame.segments.map((s) => Math.hypot(s.a.x, s.a.y)));
    expect(frame.segments.length).toBeGreaterThan(0);
    expect(reach).toBeLessThan(prepared.maxDistance * 0.8);
  });

  it('lifts the strings into a surface that follows the height field', () => {
    const r = recipe({ height: { base: 100, amplitude: 400, shape: 'dome' } });
    const frame = resolveGridFrame(r, 0, prepareGrid(r));
    const centerish = frame.nails.reduce((best, n) => (Math.hypot(n.x, n.y) < Math.hypot(best.x, best.y) ? n : best));
    const edge = frame.nails.reduce((best, n) => (Math.hypot(n.x, n.y) > Math.hypot(best.x, best.y) ? n : best));
    expect(centerish.h).toBeGreaterThan(edge.h);
  });

  it('moves nails with a warp pin and leaves far ones alone', () => {
    const r = recipe({ warp: [{ x: 0, y: 0, radius: 2, dx: 1, dy: 0 }] });
    const prepared = prepareGrid(r);
    const still = resolveGridFrame(recipe(), 0, prepared);
    const pulled = resolveGridFrame(r, 0, prepared);
    const moved = pulled.nails.filter((n, i) => Math.abs(n.x - still.nails[i].x) > 1e-6);
    expect(moved.length).toBeGreaterThan(0);
    expect(moved.length).toBeLessThan(pulled.nails.length);
  });

  it('keeps nails in the board until nailProgress raises them', () => {
    const r = recipe({ weave: { inner: 1, layers: 1, palette: ['#fff'], nailProgress: 0, drawProgress: 0 } });
    const frame = resolveGridFrame(r, 0, prepareGrid(r));
    expect(frame.nails.every((n) => n.h === 0)).toBe(true);
  });

  it('weaves only part of the board with variety.fill, and keeps unused nails in the board', () => {
    const r = recipe({ variety: { fill: 0.4, seed: 3 } });
    const prepared = prepareGrid(r);
    const full = resolveGridFrame(recipe(), 0, prepared);
    const partial = resolveGridFrame(r, 0, prepared);
    expect(partial.segments.length).toBeGreaterThan(0);
    expect(partial.segments.length).toBeLessThan(full.segments.length * 0.7);
    expect(partial.nails.some((n) => n.h === 0)).toBe(true);
  });

  it('renders the same variety every time for the same seed, so a preview matches its final', () => {
    const r = recipe({ variety: { fill: 0.6, leap: 2, layers: 1, height: 0.5, seed: 9 } });
    const prepared = prepareGrid(r);
    expect(resolveGridFrame(r, 0.5, prepared)).toEqual(resolveGridFrame(r, 0.5, prepared));
  });
});
