import { describe, it, expect } from 'vitest';
import { DesignModel } from './DesignModel.js';
import { DeformableGrid } from './DeformableGrid.js';
import { Grid } from './Grid.js';
import { CurveStore } from '../state/CurveStore.js';
import { Curve } from '../models/Curve.js';

const config = { rows: 3, cols: 3, spacing: 60, rowHeight: (60 * Math.sqrt(3)) / 2 };

function setup() {
  const grid = new Grid(config);
  const deformation = new DeformableGrid(grid);
  const curveStore = new CurveStore();
  return { grid, deformation, curveStore, design: new DesignModel(deformation, curveStore) };
}

describe('DesignModel#nails', () => {
  it('exposes one entry per grid point, id === array index, position === current (deformed) position', () => {
    const { grid, deformation, design } = setup();
    const nails = design.nails;
    expect(nails).toHaveLength(grid.points.length);
    nails.forEach((nail, i) => {
      expect(nail.id).toBe(i);
      expect(nail.position).toEqual(deformation.points[i]);
    });
  });

  it('reflects live deformation, not the base grid, once a pin moves nails', () => {
    const { grid, deformation, design } = setup();
    const anchor = grid.points[0];
    const pin = deformation.addPin({ referencePosition: anchor, radius: 1000 });
    deformation.movePin(pin, { x: anchor.x + 50, y: anchor.y });

    expect(design.nails[0].position.x).toBeCloseTo(anchor.x + 50, 5);
  });
});

describe('DesignModel#curves / #visibleCurves', () => {
  it('exposes every curve in store (paint) order, tagged with id/visible', () => {
    const { curveStore, design } = setup();
    const a = new Curve([], []);
    const b = new Curve([], []);
    const c = new Curve([], []);
    curveStore.add(a);
    curveStore.add(b);
    curveStore.add(c);

    const entries = design.curves;
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.curve)).toEqual([a, b, c]);
    expect(entries.map((e) => e.id)).toEqual([a.id, b.id, c.id]);
    expect(entries.every((e) => e.visible)).toBe(true);
  });

  it('visibleCurves filters out hidden curves', () => {
    const { curveStore, design } = setup();
    const a = new Curve([], []);
    const b = new Curve([], []);
    const c = new Curve([], []);
    curveStore.add(a);
    curveStore.add(b);
    curveStore.add(c);
    curveStore.setVisible(b.id, false);

    expect(design.curves).toHaveLength(3); // full list still includes the hidden one
    expect(design.visibleCurves.map((e) => e.curve)).toEqual([a, c]);
  });

  it('a fresh curve defaults to visible', () => {
    const { curveStore, design } = setup();
    curveStore.add(new Curve([], []));
    expect(design.visibleCurves).toHaveLength(1);
  });
});
