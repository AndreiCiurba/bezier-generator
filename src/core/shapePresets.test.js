import { describe, it, expect } from 'vitest';
import { ovalAnchors, circleAnchors, triangleAnchors, rectAnchors } from './shapePresets.js';

describe('ovalAnchors', () => {
  it('places its 4 anchors exactly at the ellipse axis extremes', () => {
    const center = { x: 5, y: -5 };
    const anchors = ovalAnchors(center, 10, 4);
    expect(anchors.map((a) => ({ x: a.x, y: a.y }))).toEqual([
      { x: 15, y: -5 },
      { x: 5, y: -1 },
      { x: -5, y: -5 },
      { x: 5, y: -9 },
    ]);
  });

  it('gives every anchor two distinct, explicit handles so autoHandles never overrides them', () => {
    const anchors = ovalAnchors({ x: 0, y: 0 }, 10, 10);
    for (const anchor of anchors) {
      expect(anchor.handleIn).not.toBeNull();
      expect(anchor.handleOut).not.toBeNull();
      expect(anchor.handleIn).not.toEqual({ x: anchor.x, y: anchor.y });
    }
  });
});

describe('circleAnchors', () => {
  it('is an oval preset with equal radii', () => {
    expect(circleAnchors({ x: 0, y: 0 }, 7)).toEqual(ovalAnchors({ x: 0, y: 0 }, 7, 7));
  });
});

describe('triangleAnchors', () => {
  it('returns 3 anchors, each with zero-length handles (straight edges)', () => {
    const anchors = triangleAnchors({ x: 0, y: 0 }, 10);
    expect(anchors).toHaveLength(3);
    for (const anchor of anchors) {
      expect(anchor.handleIn).toEqual({ x: anchor.x, y: anchor.y });
      expect(anchor.handleOut).toEqual({ x: anchor.x, y: anchor.y });
    }
  });

  it('points straight up (its first anchor sits directly above the center)', () => {
    const [first] = triangleAnchors({ x: 0, y: 0 }, 10);
    expect(first.x).toBeCloseTo(0, 9);
    expect(first.y).toBeCloseTo(-10, 9);
  });
});

describe('rectAnchors', () => {
  it('returns 4 corner anchors, each with zero-length handles (straight edges)', () => {
    const anchors = rectAnchors({ x: 0, y: 0 }, 10);
    expect(anchors).toHaveLength(4);
    for (const anchor of anchors) {
      expect(anchor.handleIn).toEqual({ x: anchor.x, y: anchor.y });
      expect(anchor.handleOut).toEqual({ x: anchor.x, y: anchor.y });
    }
  });
});
