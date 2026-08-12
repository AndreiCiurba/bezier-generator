import { describe, it, expect } from 'vitest';
import { Grid } from '../core/Grid.js';
import { DeformableGrid } from '../core/DeformableGrid.js';
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

/** The real grid nail closest to (but not exactly) `from` - an exact lattice offset, since it's read straight off the grid itself rather than hand-derived, so translating that same offset onto a *different* interior anchor lands on a real nail too (a regular lattice repeats its own local neighborhood everywhere but the boundary). */
function nearestNeighborOffset(grid, from) {
  let best = null;
  let bestDist = Infinity;
  for (const p of grid.points) {
    if (p === from) continue;
    const d = p.distanceTo(from);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return { x: best.x - from.x, y: best.y - from.y };
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
    const offset = nearestNeighborOffset(grid, target);
    viewport.panBy(50, -20);
    viewport.zoomBy(2);

    patterns.add(
      new Pattern({
        id: 'p1',
        name: 'p1',
        points: [
          { x: 0, y: 0 },
          { x: offset.x, y: offset.y },
        ],
        colors: [],
      })
    );
    patterns.select('p1');

    const screenPoint = viewport.toScreen(target.x, target.y);
    stamper.stampAtScreenPoint(screenPoint);

    expect(curves.count).toBe(1);
    expect(curves.curves[0].points[0]).toEqual({ x: target.x, y: target.y });
    expect(curves.curves[0].points[1].x).toBeCloseTo(target.x + offset.x, 5);
    expect(curves.curves[0].points[1].y).toBeCloseTo(target.y + offset.y, 5);
  });

  it('does not stamp a pattern whose translated points do not all land on real nails', () => {
    const { stamper, curves, patterns, grid } = setUp();
    const target = grid.points[3];

    // Not a real lattice offset - won't land within snap distance of any nail.
    patterns.add(
      new Pattern({
        id: 'p1',
        name: 'p1',
        points: [
          { x: 0, y: 0 },
          { x: 500, y: 500 },
        ],
        colors: [],
      })
    );
    patterns.select('p1');

    stamper.stampAtScreenPoint({ x: target.x, y: target.y });
    expect(curves.count).toBe(0);
  });

  it('snaps to the actual (deformed) nail position, not the raw rigid-translated coordinate', () => {
    const grid = new Grid({ ...gridConfig, layout: 'rotated' });
    const deformation = new DeformableGrid(grid);
    const viewport = new Viewport();
    const curves = new CurveStore();
    const patterns = new PatternStore();
    const stamper = new PatternStamper(deformation, viewport, curves, patterns);

    const target = grid.points[3];
    const offset = nearestNeighborOffset(grid, target);
    const neighborBase = { x: target.x + offset.x, y: target.y + offset.y };

    // Drag the neighbor nail itself well away from its undeformed position -
    // small enough to stay inside NAIL_SNAP_RADIUS of its *new* spot.
    const pin = deformation.addPin({ referencePosition: neighborBase, radius: 5, falloff: 1 });
    deformation.movePin(pin, { x: neighborBase.x + 5, y: neighborBase.y + 3 });
    const deformedNeighbor = deformation.findNearestPoint(neighborBase, 20);

    patterns.add(
      new Pattern({
        id: 'p1',
        name: 'p1',
        points: [
          { x: 0, y: 0 },
          { x: offset.x, y: offset.y },
        ],
        colors: [],
      })
    );
    patterns.select('p1');

    stamper.stampAtScreenPoint({ x: target.x, y: target.y });

    expect(curves.count).toBe(1);
    // Not the raw undeformed neighborBase - the nail's actual current position.
    expect(curves.curves[0].points[1]).toEqual({ x: deformedNeighbor.x, y: deformedNeighbor.y });
  });

  it('applies a flip when given, keeping the anchor point fixed', () => {
    const { stamper, curves, patterns, grid } = setUp();
    // row 2 (even) has real neighbors at both row 1 and row 3, same column -
    // a nonzero-x lattice offset whose mirror image is also a real nail,
    // needed to exercise a horizontal flip meaningfully (see class doc).
    const target = grid.points.find((p) => Math.abs(p.x - 2 * gridConfig.rowHeight) < 1e-6);
    const forwardNeighbor = grid.findNearestPoint({ x: target.x + gridConfig.rowHeight, y: target.y - gridConfig.spacing / 2 }, 1);
    const mirroredNeighbor = grid.findNearestPoint({ x: target.x - gridConfig.rowHeight, y: target.y - gridConfig.spacing / 2 }, 1);
    expect(forwardNeighbor).not.toBeNull();
    expect(mirroredNeighbor).not.toBeNull();

    patterns.add(
      new Pattern({
        id: 'p1',
        name: 'p1',
        points: [
          { x: 0, y: 0 },
          { x: forwardNeighbor.x - target.x, y: forwardNeighbor.y - target.y },
        ],
        colors: [],
      })
    );
    patterns.select('p1');

    stamper.stampAtScreenPoint(target, { horizontal: true });

    expect(curves.count).toBe(1);
    expect(curves.curves[0].points[0]).toEqual({ x: target.x, y: target.y });
    expect(curves.curves[0].points[1]).toEqual({ x: mirroredNeighbor.x, y: mirroredNeighbor.y });
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

  it('skips any anchor whose translated shape would run off the edge of the grid', () => {
    const { stamper, curves, patterns, grid } = setUp();
    const offset = nearestNeighborOffset(grid, grid.points[3]);

    patterns.add(
      new Pattern({
        id: 'p1',
        name: 'p1',
        points: [
          { x: 0, y: 0 },
          { x: offset.x, y: offset.y },
        ],
        colors: [],
      })
    );
    patterns.select('p1');

    stamper.stampThroughoutGrid();

    // Every stamped curve's second point must itself be a real nail (never a
    // floating, off-grid coordinate) - and at least one anchor near the edge
    // has no matching neighbor in that direction, so fewer curves than nails.
    expect(curves.count).toBeGreaterThan(0);
    expect(curves.count).toBeLessThan(grid.points.length);
    for (const curve of curves.curves) {
      const nail = grid.findNearestPoint(curve.points[1], 0.001);
      expect(nail).not.toBeNull();
    }
  });

  it('re-anchors correctly after setGrid points it at a resized grid', () => {
    const { stamper, curves, patterns } = setUp();
    patterns.add(new Pattern({ id: 'p1', name: 'p1', points: [{ x: 0, y: 0 }], colors: [] }));
    patterns.select('p1');

    const biggerGrid = new Grid({ ...gridConfig, rows: 6, cols: 6, layout: 'rotated' });
    stamper.setGrid(biggerGrid);
    stamper.stampThroughoutGrid();

    expect(curves.count).toBe(biggerGrid.points.length);
  });
});
