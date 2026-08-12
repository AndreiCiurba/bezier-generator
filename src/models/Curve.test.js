import { describe, it, expect } from 'vitest';
import { Curve, isLiveAutoPatternCurve } from './Curve.js';

function fakePatterns({ selectedPatternId = null, isInUse = false, placementMode = 'manual' } = {}) {
  return { selectedPatternId, isInUse, placementMode };
}

describe('Curve#renderWeight', () => {
  it('falls back to the color-count-derived weight when no explicit weight is set', () => {
    const curve = new Curve([], [{ color: '#a', enabled: true }, { color: '#b', enabled: true }], null, null);
    expect(curve.renderWeight).toBeGreaterThan(0);
  });

  it('uses the explicit weight when one was given, ignoring color count', () => {
    const curve = new Curve([], [{ color: '#a', enabled: true }], null, 7);
    expect(curve.renderWeight).toBe(7);
  });
});

describe('isLiveAutoPatternCurve', () => {
  it('is true only when the curve belongs to the selected pattern, in use, and in Auto mode', () => {
    const curve = new Curve([], [], 'p1', null);
    const patterns = fakePatterns({ selectedPatternId: 'p1', isInUse: true, placementMode: 'auto' });
    expect(isLiveAutoPatternCurve(curve, patterns)).toBe(true);
  });

  it('is false for a hand-drawn curve (no pattern id)', () => {
    const curve = new Curve([], [], null, null);
    const patterns = fakePatterns({ selectedPatternId: null, isInUse: true, placementMode: 'auto' });
    expect(isLiveAutoPatternCurve(curve, patterns)).toBe(false);
  });

  it('is false once the pattern is deselected (isInUse false), even if it still matches the id', () => {
    const curve = new Curve([], [], 'p1', null);
    const patterns = fakePatterns({ selectedPatternId: 'p1', isInUse: false, placementMode: 'auto' });
    expect(isLiveAutoPatternCurve(curve, patterns)).toBe(false);
  });

  it('is false in Manual placement mode', () => {
    const curve = new Curve([], [], 'p1', null);
    const patterns = fakePatterns({ selectedPatternId: 'p1', isInUse: true, placementMode: 'manual' });
    expect(isLiveAutoPatternCurve(curve, patterns)).toBe(false);
  });

  it('is false for a curve belonging to a different pattern than the one currently selected', () => {
    const curve = new Curve([], [], 'p1', null);
    const patterns = fakePatterns({ selectedPatternId: 'p2', isInUse: true, placementMode: 'auto' });
    expect(isLiveAutoPatternCurve(curve, patterns)).toBe(false);
  });
});
