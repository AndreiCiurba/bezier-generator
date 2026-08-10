import { describe, it, expect } from 'vitest';
import { Pattern } from './Pattern.js';

const colors = [{ color: '#ffffff', enabled: true }];

describe('Pattern#translatedTo', () => {
  it('anchors points[0] exactly on the given anchor', () => {
    const pattern = new Pattern({
      id: '1',
      name: 'test',
      points: [
        { x: 10, y: 10 },
        { x: 20, y: 10 },
        { x: 20, y: 20 },
      ],
      colors,
    });

    const translated = pattern.translatedTo({ x: 100, y: 50 });
    expect(translated[0]).toEqual({ x: 100, y: 50 });
  });

  it('preserves the shape (relative offsets between points)', () => {
    const pattern = new Pattern({
      id: '1',
      name: 'test',
      points: [
        { x: 10, y: 10 },
        { x: 20, y: 10 },
        { x: 20, y: 20 },
      ],
      colors,
    });

    const translated = pattern.translatedTo({ x: 0, y: 0 });
    expect(translated[1].sub(translated[0])).toEqual({ x: 10, y: 0 });
    expect(translated[2].sub(translated[0])).toEqual({ x: 10, y: 10 });
  });

  it('does not mutate the pattern itself', () => {
    const pattern = new Pattern({ id: '1', name: 'test', points: [{ x: 5, y: 5 }], colors });
    pattern.translatedTo({ x: 500, y: 500 });
    expect(pattern.points[0]).toEqual({ x: 5, y: 5 });
  });
});
