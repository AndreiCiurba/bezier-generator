import { describe, it, expect } from 'vitest';
import { anchorsCentroid, transformAnchors } from './shapeTransform.js';
import { triangleAnchors } from './shapePresets.js';

const square = [
  { x: 0, y: 0, handleIn: null, handleOut: null },
  { x: 10, y: 0, handleIn: null, handleOut: null },
  { x: 10, y: 10, handleIn: null, handleOut: null },
  { x: 0, y: 10, handleIn: null, handleOut: null },
];

describe('anchorsCentroid', () => {
  it('averages every anchor\'s own x/y', () => {
    expect(anchorsCentroid(square)).toEqual({ x: 5, y: 5 });
  });
});

describe('transformAnchors', () => {
  it('a pure translate (rotation 0, scale 1) shifts every anchor by position - centroid', () => {
    const translated = transformAnchors(square, { position: { x: 105, y: 55 } });
    // square's own centroid is (5,5); moving it to (105,55) is a (+100,+50) shift.
    expect(translated.map((a) => ({ x: a.x, y: a.y }))).toEqual([
      { x: 100, y: 50 },
      { x: 110, y: 50 },
      { x: 110, y: 60 },
      { x: 100, y: 60 },
    ]);
  });

  it('scales distances from the centroid by the given factor', () => {
    const scaled = transformAnchors(square, { position: { x: 5, y: 5 }, scale: 2 });
    // Same centroid (5,5), doubled extent -> corners move from +/-5 to +/-10 around it.
    expect(scaled.map((a) => ({ x: a.x, y: a.y }))).toEqual([
      { x: -5, y: -5 },
      { x: 15, y: -5 },
      { x: 15, y: 15 },
      { x: -5, y: 15 },
    ]);
  });

  it('moves handles along with their anchor', () => {
    const anchors = [
      { x: 0, y: 0, handleIn: { x: -2, y: 0 }, handleOut: { x: 2, y: 0 } },
      { x: 10, y: 0, handleIn: null, handleOut: null },
      { x: 5, y: 10, handleIn: null, handleOut: null },
    ];
    const translated = transformAnchors(anchors, { position: { x: 100, y: 100 } });
    const dx = translated[0].x - anchors[0].x;
    const dy = translated[0].y - anchors[0].y;
    expect(translated[0].handleOut).toEqual({ x: anchors[0].handleOut.x + dx, y: anchors[0].handleOut.y + dy });
    expect(translated[0].handleIn).toEqual({ x: anchors[0].handleIn.x + dx, y: anchors[0].handleIn.y + dy });
  });

  it('leaves null handles null', () => {
    const transformed = transformAnchors(square, { position: { x: 0, y: 0 }, rotationRadians: 1, scale: 3 });
    for (const anchor of transformed) {
      expect(anchor.handleIn).toBeNull();
      expect(anchor.handleOut).toBeNull();
    }
  });

  it('always lands the transformed centroid exactly on position, for any rotation/scale', () => {
    const anchors = triangleAnchors({ x: 7, y: -3 }, 10);
    const position = { x: 42, y: -17 };
    const transformed = transformAnchors(anchors, { position, rotationRadians: Math.PI / 5, scale: 1.7 });
    const centroid = anchorsCentroid(transformed);
    expect(centroid.x).toBeCloseTo(position.x, 9);
    expect(centroid.y).toBeCloseTo(position.y, 9);
  });

  it('an identity transform (own centroid as position, no rotation, scale 1) is a no-op', () => {
    const centroid = anchorsCentroid(square);
    const transformed = transformAnchors(square, { position: centroid });
    transformed.forEach((anchor, i) => {
      expect(anchor.x).toBeCloseTo(square[i].x, 9);
      expect(anchor.y).toBeCloseTo(square[i].y, 9);
    });
  });
});
