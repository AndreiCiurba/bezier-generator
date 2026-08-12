import { describe, it, expect } from 'vitest';
import { to3D, fromWorld3 } from './axisMapping.js';

describe('to3D', () => {
  it('maps 2D x/y to 3D x/z, height to 3D y', () => {
    expect(to3D({ x: 10, y: 20 }, 5)).toEqual({ x: 10, y: 5, z: 20 });
  });

  it('defaults height to 0 (board-plane level) when omitted', () => {
    expect(to3D({ x: 1, y: 2 })).toEqual({ x: 1, y: 0, z: 2 });
  });
});

describe('fromWorld3', () => {
  it('drops the 3D y (height), recovering the 2D x/y', () => {
    expect(fromWorld3({ x: 10, y: 999, z: 20 })).toEqual({ x: 10, y: 20 });
  });
});

describe('to3D / fromWorld3 round-trip', () => {
  it('fromWorld3(to3D(p, h)) recovers the original 2D point regardless of height', () => {
    const point = { x: 42, y: -17 };
    for (const height of [0, 5, -100, 1000]) {
      expect(fromWorld3(to3D(point, height))).toEqual(point);
    }
  });
});
