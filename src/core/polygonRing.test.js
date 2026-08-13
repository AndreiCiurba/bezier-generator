import { describe, it, expect } from 'vitest';
import { polygonCircumradius, polygonVertices } from './polygonRing.js';

describe('polygonCircumradius', () => {
  it('matches the standard regular-polygon formula (edge length / (2 sin(pi/sides)))', () => {
    // A square (4 sides) with 1 segment per edge and spacing 60 has edge length 60;
    // circumradius of a square with side 60 is 60 / sqrt(2) ~= 42.426.
    expect(polygonCircumradius(4, 1, 60)).toBeCloseTo(60 / Math.SQRT2, 5);
  });

  it('scales linearly with segmentsPerEdge and spacing', () => {
    const base = polygonCircumradius(5, 3, 60);
    expect(polygonCircumradius(5, 6, 60)).toBeCloseTo(base * 2, 10);
    expect(polygonCircumradius(5, 3, 120)).toBeCloseTo(base * 2, 10);
  });
});

describe('polygonVertices', () => {
  it('returns exactly `sides` vertices, each at the given radius from the origin', () => {
    const vertices = polygonVertices(5, 100);
    expect(vertices).toHaveLength(5);
    for (const v of vertices) {
      expect(Math.hypot(v.x, v.y)).toBeCloseTo(100, 10);
    }
  });

  it('defaults to pointy-top: vertex 0 straight up at (0, -radius)', () => {
    const [first] = polygonVertices(5, 100);
    expect(first.x).toBeCloseTo(0, 10);
    expect(first.y).toBeCloseTo(-100, 10);
  });

  it('rotationOffset rotates every vertex by the same amount without changing the radius', () => {
    const base = polygonVertices(4, 100);
    const rotated = polygonVertices(4, 100, Math.PI / 4);
    // Flat-top square (rotationOffset = pi/4 = half a step) puts vertex 0 at a diagonal, not straight up.
    expect(rotated[0].x).toBeCloseTo(100 * Math.SQRT1_2, 10);
    expect(rotated[0].y).toBeCloseTo(-100 * Math.SQRT1_2, 10);
    expect(rotated).toHaveLength(base.length);
  });

  it('adjacent vertices are evenly spaced by angle (equal chord length for a regular polygon)', () => {
    const vertices = polygonVertices(6, 50);
    const chord = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const chords = vertices.map((v, i) => chord(v, vertices[(i + 1) % vertices.length]));
    for (const c of chords) expect(c).toBeCloseTo(chords[0], 10);
  });
});
