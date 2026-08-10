import { describe, it, expect } from 'vitest';
import { Grid } from '../core/Grid.js';
import { Viewport } from '../core/Viewport.js';
import { CurveStore } from '../state/CurveStore.js';
import { PatternStore } from '../state/PatternStore.js';
import { Pattern } from '../models/Pattern.js';
import { PatternStamper } from './PatternStamper.js';

const gridConfig = { rows: 4, cols: 4, spacing: 60, rowHeight: (60 * Math.sqrt(3)) / 2 };

function setUp() {
  const grid = new Grid({ ...gridConfig, layout: 'rotated' });
  const viewport = new Viewport();
  const curves = new CurveStore();
  const patterns = new PatternStore();
  const stamper = new PatternStamper(grid, viewport, curves, patterns);
  return { grid, viewport, curves, patterns, stamper };
}

describe('PatternStamper#stampAtScreenPoint', () => {
  it('does nothing when no pattern is selected', () => {
    const { stamper, curves } = setUp();
    stamper.stampAtScreenPoint({ x: 0, y: 0 });
    expect(curves.count).toBe(0);
  });

  it('does nothing when no nail is near the click', () => {
    const { stamper, curves, patterns } = setUp();
    patterns.add(new Pattern({ id: 'p1', name: 'p1', points: [{ x: 0, y: 0 }], colors: [] }));
    patterns.select('p1');
    stamper.stampAtScreenPoint({ x: -99999, y: -99999 });
    expect(curves.count).toBe(0);
  });

  it('anchors the stamped curve on the nail nearest the click, honoring pan/zoom', () => {
    const { stamper, curves, patterns, grid, viewport } = setUp();
    const target = grid.points[3];
    viewport.panBy(50, -20);
    viewport.zoomBy(2);

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

    const screenPoint = viewport.toScreen(target.x, target.y);
    stamper.stampAtScreenPoint(screenPoint);

    expect(curves.count).toBe(1);
    expect(curves.curves[0].points[0]).toEqual({ x: target.x, y: target.y });
  });
});

describe('PatternStamper#stampThroughoutGrid', () => {
  it('stamps one curve per grid point, and only once per pattern', () => {
    const { stamper, curves, patterns, grid } = setUp();
    patterns.add(new Pattern({ id: 'p1', name: 'p1', points: [{ x: 0, y: 0 }], colors: [] }));
    patterns.select('p1');

    stamper.stampThroughoutGrid();
    expect(curves.count).toBe(grid.points.length);

    stamper.stampThroughoutGrid(); // second call should be a no-op
    expect(curves.count).toBe(grid.points.length);
  });
});
