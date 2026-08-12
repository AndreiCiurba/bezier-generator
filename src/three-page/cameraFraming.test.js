import { describe, it, expect } from 'vitest';
import { DEFAULT_VIEW_DIRECTION, framingDistance, defaultCameraPosition, orthographicHalfExtents } from './cameraFraming.js';

describe('DEFAULT_VIEW_DIRECTION', () => {
  it('is a unit vector', () => {
    const length = Math.sqrt(
      DEFAULT_VIEW_DIRECTION.x ** 2 + DEFAULT_VIEW_DIRECTION.y ** 2 + DEFAULT_VIEW_DIRECTION.z ** 2
    );
    expect(length).toBeCloseTo(1, 10);
  });
});

describe('framingDistance', () => {
  it('grows with a larger board footprint', () => {
    const small = framingDistance(400, 400, 50);
    const large = framingDistance(1200, 1200, 50);
    expect(large).toBeGreaterThan(small);
  });

  it('a wider FOV needs a shorter distance to frame the same board', () => {
    const narrowFov = framingDistance(600, 600, 30);
    const wideFov = framingDistance(600, 600, 90);
    expect(wideFov).toBeLessThan(narrowFov);
  });

  it('a larger padding multiplier pushes the camera further back', () => {
    const tight = framingDistance(600, 600, 50, 1.0);
    const padded = framingDistance(600, 600, 50, 1.5);
    expect(padded).toBeGreaterThan(tight);
  });
});

describe('defaultCameraPosition', () => {
  it('scales proportionally with the framing distance, along DEFAULT_VIEW_DIRECTION', () => {
    const distance = framingDistance(800, 800, 50);
    const position = defaultCameraPosition(800, 800, 50);
    expect(position.x).toBeCloseTo(DEFAULT_VIEW_DIRECTION.x * distance, 10);
    expect(position.y).toBeCloseTo(DEFAULT_VIEW_DIRECTION.y * distance, 10);
    expect(position.z).toBeCloseTo(DEFAULT_VIEW_DIRECTION.z * distance, 10);
  });

  it('a square board has an equal-magnitude framing regardless of orientation', () => {
    const a = defaultCameraPosition(500, 900, 50);
    const b = defaultCameraPosition(900, 500, 50);
    // Same diagonal either way (width/depth swapped), so the same distance.
    const distA = Math.sqrt(a.x ** 2 + a.y ** 2 + a.z ** 2);
    const distB = Math.sqrt(b.x ** 2 + b.y ** 2 + b.z ** 2);
    expect(distA).toBeCloseTo(distB, 10);
  });
});

describe('orthographicHalfExtents', () => {
  it('a square board in a square viewport needs no letterboxing - both halves equal the padded board half-extent', () => {
    const { halfWidth, halfHeight } = orthographicHalfExtents(600, 600, 1000, 1000, 1.1);
    expect(halfWidth).toBeCloseTo(330, 10); // 600/2 * 1.1
    expect(halfHeight).toBeCloseTo(330, 10);
  });

  it('a viewport proportionally wider than the board fits by height and expands width (pillarboxing the board)', () => {
    const { halfWidth, halfHeight } = orthographicHalfExtents(600, 600, 2000, 1000, 1.0);
    expect(halfHeight).toBeCloseTo(300, 10); // unchanged - constrained dimension
    expect(halfWidth).toBeCloseTo(300 * 2, 10); // stretched to match the 2:1 viewport aspect
  });

  it('a viewport proportionally taller than the board fits by width and expands height', () => {
    const { halfWidth, halfHeight } = orthographicHalfExtents(600, 600, 1000, 2000, 1.0);
    expect(halfWidth).toBeCloseTo(300, 10);
    expect(halfHeight).toBeCloseTo(300 * 2, 10);
  });

  it('the resulting frustum always has the exact viewport aspect ratio, regardless of board shape', () => {
    for (const [vw, vh] of [
      [1920, 1080],
      [800, 600],
      [500, 1200],
    ]) {
      const { halfWidth, halfHeight } = orthographicHalfExtents(700, 450, vw, vh);
      expect(halfWidth / halfHeight).toBeCloseTo(vw / vh, 10);
    }
  });

  it('never crops the board - both half-extents are at least the padded board half-extent', () => {
    const boardHalfWidth = (900 / 2) * 1.1;
    const boardHalfDepth = (400 / 2) * 1.1;
    const { halfWidth, halfHeight } = orthographicHalfExtents(900, 400, 1300, 700, 1.1);
    expect(halfWidth).toBeGreaterThanOrEqual(boardHalfWidth - 1e-9);
    expect(halfHeight).toBeGreaterThanOrEqual(boardHalfDepth - 1e-9);
  });
});
