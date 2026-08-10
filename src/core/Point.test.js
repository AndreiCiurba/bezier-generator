import { describe, it, expect } from 'vitest';
import { Point } from './Point.js';

describe('Point', () => {
  it('copy produces an equal but distinct instance', () => {
    const a = new Point(1, 2);
    const b = a.copy();
    expect(b).not.toBe(a);
    expect(b.x).toBe(1);
    expect(b.y).toBe(2);
  });

  it('set mutates in place', () => {
    const a = new Point(0, 0);
    const result = a.set(5, 6);
    expect(a.x).toBe(5);
    expect(a.y).toBe(6);
    expect(result).toBe(a);
  });

  it('sub and add are inverses', () => {
    const a = new Point(10, 4);
    const b = new Point(3, 7);
    expect(a.sub(b).add(b)).toEqual(a);
  });

  it('distanceTo computes euclidean distance', () => {
    const a = new Point(0, 0);
    const b = new Point(3, 4);
    expect(a.distanceTo(b)).toBe(5);
  });

  it('from() accepts any {x,y}-shaped object', () => {
    const p = Point.from({ x: 1, y: 2, someOtherField: true });
    expect(p).toBeInstanceOf(Point);
    expect(p.x).toBe(1);
    expect(p.y).toBe(2);
  });
});
