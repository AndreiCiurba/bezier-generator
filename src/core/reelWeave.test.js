import { describe, it, expect } from 'vitest';
import { partialClosedWeave, stackHeight, hash01 } from './reelWeave.js';

const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
const flat = () => 0;

describe('partialClosedWeave', () => {
  it('draws every chord of every layer once the weave is complete, so a finished reel matches the app', () => {
    const segments = partialClosedWeave({ ring: square, inner: 1, leap: 0, layerColors: ['#ff0000', '#00ff00'], heightAt: flat });
    expect(segments).toHaveLength(16); // 8 ring points x 2 layers
  });

  it('draws nothing before the build-up starts', () => {
    expect(partialClosedWeave({ ring: square, inner: 1, leap: 0, layerColors: ['#fff'], progress: 0, heightAt: flat })).toEqual([]);
  });

  it('cuts the chord being strung short, so a slow build visibly travels instead of popping in whole chords', () => {
    const segments = partialClosedWeave({ ring: square, leap: 0, layerColors: ['#fff'], progress: 0.375, heightAt: flat });
    expect(segments).toHaveLength(2); // 1.5 of 4 chords
    const [whole, half] = segments;
    const wholeLength = Math.hypot(whole.b.x - whole.a.x, whole.b.y - whole.a.y);
    const halfLength = Math.hypot(half.b.x - half.a.x, half.b.y - half.a.y);
    expect(halfLength).toBeCloseTo(wholeLength / 2);
  });

  it('strings the bottom layer completely before starting the next one in sequential mode', () => {
    const segments = partialClosedWeave({ ring: square, leap: 0, layerColors: ['#aaaaaa', '#bbbbbb'], progress: 0.5, heightAt: flat });
    expect(segments.every((s) => s.color === '#aaaaaa')).toBe(true);
    expect(segments).toHaveLength(4);
  });

  it('asks heightAt for each end, so a string can follow a height field', () => {
    const segments = partialClosedWeave({ ring: square, leap: 0, layerColors: ['#fff'], heightAt: (layer, p) => p.x });
    for (const s of segments) {
      expect(s.a.h).toBe(s.a.x);
      expect(s.b.h).toBe(s.b.x);
    }
  });
});

describe('stackHeight', () => {
  it('keeps an equal margin above and below the stack, like the app does', () => {
    expect(stackHeight(0, 3, 100, 400)).toBe(200);
    expect(stackHeight(2, 3, 100, 400)).toBe(400);
  });
});

describe('hash01', () => {
  it('is deterministic and inside [0, 1), so a "random" order is the same on every render', () => {
    expect(hash01(5)).toBe(hash01(5));
    for (let i = 0; i < 50; i++) {
      expect(hash01(i)).toBeGreaterThanOrEqual(0);
      expect(hash01(i)).toBeLessThan(1);
    }
  });
});
