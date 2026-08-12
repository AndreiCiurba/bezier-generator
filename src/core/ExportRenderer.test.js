import { describe, it, expect } from 'vitest';
import { ExportRenderer } from './ExportRenderer.js';
import { Curve } from '../models/Curve.js';
import { Point } from './Point.js';
import { controlPointDiameterForColorCount, innerPointDiameterForColorCount } from './nailDotSize.js';

// A fake p5.Graphics that just records what was drawn - ExportRenderer only
// ever calls a handful of methods on it, all dependency-injected (never a
// global p5 call), so this is enough to exercise it directly without a real
// canvas.
function createMockPg() {
  const ellipses = [];
  const lines = [];
  return {
    background() {},
    noStroke() {},
    noFill() {},
    fill() {},
    stroke() {},
    strokeWeight() {},
    ellipse(x, y, w) {
      ellipses.push({ x, y, diameter: w });
    },
    line(x1, y1, x2, y2) {
      lines.push({ x1, y1, x2, y2 });
    },
    ellipses,
    lines,
  };
}

function colorsOf(n) {
  return Array.from({ length: n }, () => ({ color: '#fff', enabled: true }));
}

describe('ExportRenderer.renderNails', () => {
  it('without a lattice (freestyle), control points come only from curve.points', () => {
    const points = [new Point(0, 0), new Point(10, 0), new Point(10, 10)];
    const curve = new Curve(points, colorsOf(8));
    const pg = createMockPg();

    ExportRenderer.renderNails(pg, [curve]);

    const controlDiameter = controlPointDiameterForColorCount(8);
    const controlDots = pg.ellipses.filter((e) => e.diameter === controlDiameter);
    expect(controlDots).toHaveLength(3);
    expect(controlDots.map((d) => ({ x: d.x, y: d.y }))).toEqual(points.map((p) => ({ x: p.x, y: p.y })));
  });

  it('with a lattice (the grid tool), control points come from every lattice point, not curve.points', () => {
    const curvePoints = [new Point(0, 0), new Point(10, 0), new Point(10, 10)];
    const curve = new Curve(curvePoints, colorsOf(8));
    const lattice = {
      points: [new Point(0, 0), new Point(50, 50), new Point(100, 100)], // an unrelated, larger set
      colorCount: 4,
    };
    const pg = createMockPg();

    ExportRenderer.renderNails(pg, [curve], lattice);

    const latticeDiameter = controlPointDiameterForColorCount(4);
    const controlDots = pg.ellipses.filter((e) => e.diameter === latticeDiameter);
    expect(controlDots).toHaveLength(3);
    expect(controlDots.map((d) => ({ x: d.x, y: d.y }))).toEqual(lattice.points.map((p) => ({ x: p.x, y: p.y })));

    // curve.points themselves are NOT drawn again as control points in
    // lattice mode - every curve point is already a lattice nail.
    const curveOnlyPoint = { x: 10, y: 10 };
    const dotsAtCurvePoint = pg.ellipses.filter(
      (e) => e.x === curveOnlyPoint.x && e.y === curveOnlyPoint.y && e.diameter === controlPointDiameterForColorCount(8)
    );
    expect(dotsAtCurvePoint).toHaveLength(0);
  });

  it('includes a lattice even with zero curves (the bare board template)', () => {
    const lattice = { points: [new Point(1, 1), new Point(2, 2)], colorCount: 8 };
    const pg = createMockPg();

    ExportRenderer.renderNails(pg, [], lattice);

    expect(pg.ellipses).toHaveLength(2);
  });

  it('still draws every curve\'s own inner points, regardless of lattice mode', () => {
    const points = [new Point(0, 0), new Point(8, 0)];
    const curve = new Curve(points, colorsOf(4)); // segments=4 -> 3 inner points
    const lattice = { points: [], colorCount: 8 };
    const pg = createMockPg();

    ExportRenderer.renderNails(pg, [curve], lattice);

    const innerDiameter = innerPointDiameterForColorCount(4);
    const innerDots = pg.ellipses.filter((e) => e.diameter === innerDiameter);
    expect(innerDots).toHaveLength(3);
  });
});

describe('ExportRenderer.renderNailsAndStrings', () => {
  it('draws weave lines using each curve\'s own renderWeight, plus the nails', () => {
    const points = [new Point(0, 0), new Point(10, 0), new Point(10, 10), new Point(0, 10)];
    const curve = new Curve(points, colorsOf(1), null, 3); // explicit weight
    const pg = createMockPg();

    ExportRenderer.renderNailsAndStrings(pg, [curve]);

    expect(pg.lines.length).toBeGreaterThan(0);
    expect(pg.ellipses.length).toBeGreaterThan(0);
  });
});
