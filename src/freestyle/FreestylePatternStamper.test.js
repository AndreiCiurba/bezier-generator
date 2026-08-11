import { describe, it, expect } from 'vitest';
import { Viewport } from '../core/Viewport.js';
import { CurveStore } from '../state/CurveStore.js';
import { PatternStore } from '../state/PatternStore.js';
import { Pattern } from '../models/Pattern.js';
import { FreestylePatternStamper } from './FreestylePatternStamper.js';

function setUp() {
  const viewport = new Viewport();
  const curves = new CurveStore();
  const patterns = new PatternStore();
  const stamper = new FreestylePatternStamper(viewport, curves, patterns);
  return { viewport, curves, patterns, stamper };
}

describe('FreestylePatternStamper#stampAtScreenPoint', () => {
  it('does nothing when no pattern is selected', () => {
    const { stamper, curves } = setUp();
    stamper.stampAtScreenPoint({ x: 50, y: 50 });
    expect(curves.count).toBe(0);
  });

  it('anchors the pattern exactly at the click, honoring pan/zoom, with no snapping', () => {
    const { stamper, curves, patterns, viewport } = setUp();
    viewport.panBy(30, -10);
    viewport.zoomBy(1.5);

    patterns.add(
      new Pattern({
        id: 'p1',
        name: 'p1',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        colors: [],
      })
    );
    patterns.select('p1');

    const anchor = { x: 123.4, y: 56.7 }; // an arbitrary world point, not a grid nail
    const screenPoint = viewport.toScreen(anchor.x, anchor.y);
    stamper.stampAtScreenPoint(screenPoint);

    expect(curves.count).toBe(1);
    expect(curves.curves[0].points[0].x).toBeCloseTo(anchor.x, 5);
    expect(curves.curves[0].points[0].y).toBeCloseTo(anchor.y, 5);
  });

  it('applies a flip when given, keeping the anchor point fixed', () => {
    const { stamper, curves, patterns } = setUp();
    patterns.add(
      new Pattern({
        id: 'p1',
        name: 'p1',
        points: [
          { x: 0, y: 0 },
          { x: 0, y: 10 },
        ],
        colors: [],
      })
    );
    patterns.select('p1');

    stamper.stampAtScreenPoint({ x: 50, y: 50 }, { vertical: true });

    expect(curves.curves[0].points[0]).toEqual({ x: 50, y: 50 });
    // Unflipped this would land at y=60; flipped it mirrors to y=40.
    expect(curves.curves[0].points[1].y).toBeCloseTo(40, 5);
  });

  it('each stamp gets its own color array, not a shared reference', () => {
    const { stamper, curves, patterns } = setUp();
    patterns.add(new Pattern({ id: 'p1', name: 'p1', points: [{ x: 0, y: 0 }], colors: [{ color: '#fff', enabled: true }] }));
    patterns.select('p1');

    stamper.stampAtScreenPoint({ x: 0, y: 0 });
    stamper.stampAtScreenPoint({ x: 10, y: 10 });

    expect(curves.curves[0].colors).not.toBe(curves.curves[1].colors);
  });
});
