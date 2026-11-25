import { describe, it, expect } from 'vitest';
import {
  mmToWorld, worldToCm, threadGeometry, wrapStrands, expandToStrands, normalizeThreadSettings, nailHasHead,
  DEFAULT_THREAD_WIDTH_MM, DEFAULT_NAIL_DIAMETER_MM,
} from './threadWrap.js';

const distanceToLine = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / Math.hypot(dx, dy);
};

describe('real-world scale', () => {
  it('maps the default 12000-unit board to 120 cm, so board sizes can be read as real measurements', () => {
    expect(worldToCm(12000)).toBe(120);
  });

  it('makes the 0.25 mm thread 2.5 world units wide, the same on any board size', () => {
    expect(mmToWorld(0.25)).toBe(2.5);
  });
});

describe('threadGeometry', () => {
  it('wraps the strand centreline at nail radius + thread radius, because the thread lies against the nail surface', () => {
    const g = threadGeometry({ threadWidthMm: 0.25, nailDiameterMm: 4, technique: 'O' });
    expect(g.nailRadius).toBe(20);
    expect(g.wrapRadius).toBeCloseTo(21.25);
  });

  it('scales the nail by the instance nail scale, so a thicker nail spreads the strands too', () => {
    expect(threadGeometry({ threadWidthMm: 0.25, nailDiameterMm: 1, technique: '8' }, 2).nailRadius).toBe(10);
  });
});

describe('wrapStrands', () => {
  const a = { x: 0, y: 0 };
  const b = { x: 1000, y: 0 };

  it('runs O-shape strands parallel, one wrap diameter apart, which is why O reads as a thicker line', () => {
    const [s1, s2] = wrapStrands(a, b, 10, 'O');
    expect(s1.from.y).toBeCloseTo(10);
    expect(s1.to.y).toBeCloseTo(10);
    expect(s2.from.y).toBeCloseTo(-10);
    expect(s2.to.y).toBeCloseTo(-10);
  });

  it('crosses 8-shape strands at the midpoint, which is why 8 reads as a thinner line', () => {
    const [s1, s2] = wrapStrands(a, b, 10, '8');
    const mid = { x: 500, y: 0 };
    expect(distanceToLine(mid, s1.from, s1.to)).toBeCloseTo(0);
    expect(distanceToLine(mid, s2.from, s2.to)).toBeCloseTo(0);
    expect(Math.sign(s1.from.y)).toBe(-Math.sign(s1.to.y));
  });

  it('keeps 8-shape strands tangent to each nail, touching it at exactly the wrap radius', () => {
    for (const s of wrapStrands(a, b, 10, '8')) {
      expect(distanceToLine(a, s.from, s.to)).toBeCloseTo(10);
      expect(distanceToLine(b, s.from, s.to)).toBeCloseTo(10);
    }
  });

  it('still returns two strands when the nails nearly touch and there is no crossing tangent', () => {
    expect(wrapStrands(a, { x: 5, y: 0 }, 10, '8')).toHaveLength(2);
  });
});

describe('expandToStrands', () => {
  it('doubles every segment and keeps its color and layer, so layering and colors are unchanged', () => {
    const strands = expandToStrands([{ from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, color: '#f00', layerIndex: 2 }], 5, 'O');
    expect(strands).toHaveLength(2);
    expect(strands.every((s) => s.color === '#f00' && s.layerIndex === 2)).toBe(true);
  });

  it('keeps one strand for a single segment, where the thread ends going one way at the end of a cardioid run', () => {
    const strands = expandToStrands([{ from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, single: true }], 5, '8');
    expect(strands).toHaveLength(1);
  });
});

describe('normalizeThreadSettings', () => {
  it('falls back to the 0.25 mm thread and default nail when nothing is saved yet', () => {
    expect(normalizeThreadSettings(null)).toEqual({
      threadWidthMm: DEFAULT_THREAD_WIDTH_MM, nailDiameterMm: DEFAULT_NAIL_DIAMETER_MM, technique: '8',
    });
  });

  it('keeps valid saved values so the physical setup survives a reload', () => {
    expect(normalizeThreadSettings({ threadWidthMm: 0.4, nailDiameterMm: 4, technique: 'O' }))
      .toEqual({ threadWidthMm: 0.4, nailDiameterMm: 4, technique: 'O' });
  });
});

describe('nailHasHead', () => {
  it('gives thin nails a head but draws 3 mm and wider nails as plain rods, like the real ones', () => {
    expect(nailHasHead(1.5)).toBe(true);
    expect(nailHasHead(2.99)).toBe(true);
    expect(nailHasHead(3)).toBe(false);
    expect(nailHasHead(5)).toBe(false);
  });
});
