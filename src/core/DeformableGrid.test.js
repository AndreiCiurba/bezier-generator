import { describe, it, expect } from 'vitest';
import { DeformableGrid, DEFAULT_PIN_RADIUS, DEFAULT_PIN_FALLOFF } from './DeformableGrid.js';
import { Grid } from './Grid.js';
import { Point } from './Point.js';

const config = { rows: 5, cols: 5, spacing: 60, rowHeight: (60 * Math.sqrt(3)) / 2 };

describe('DeformableGrid', () => {
  it('with zero pins, .points is identical to the base grid (no regression)', () => {
    const grid = new Grid(config);
    const deformable = new DeformableGrid(grid);
    expect(deformable.points).toEqual(grid.points);
  });

  it('findNearestPoint matches the base grid when undeformed', () => {
    const grid = new Grid(config);
    const deformable = new DeformableGrid(grid);
    const target = grid.points[3];
    expect(deformable.findNearestPoint(target, 1)).toEqual(target);
  });

  it('addPin defaults position to referencePosition (zero initial displacement)', () => {
    const grid = new Grid(config);
    const deformable = new DeformableGrid(grid);
    const anchor = grid.points[0];

    const pin = deformable.addPin({ referencePosition: anchor });
    expect(pin.position).toEqual(pin.referencePosition);
    expect(pin.radius).toBe(DEFAULT_PIN_RADIUS);
    expect(pin.falloff).toBe(DEFAULT_PIN_FALLOFF);
    // Zero displacement -> grid still reads as undeformed.
    expect(deformable.points).toEqual(grid.points);
  });

  it('movePin deforms the grid, and .points reflects it on the next read', () => {
    const grid = new Grid(config);
    const deformable = new DeformableGrid(grid);
    const anchor = grid.points[0];
    const pin = deformable.addPin({ referencePosition: anchor, radius: 1000 });

    deformable.movePin(pin, { x: anchor.x + 50, y: anchor.y });

    const deformedAnchor = deformable.points[0];
    expect(deformedAnchor.x).toBeCloseTo(anchor.x + 50, 5);
  });

  it('removePin drops it and reverts affected points', () => {
    const grid = new Grid(config);
    const deformable = new DeformableGrid(grid);
    const anchor = grid.points[0];
    const pin = deformable.addPin({ referencePosition: anchor, radius: 1000 });
    deformable.movePin(pin, { x: anchor.x + 50, y: anchor.y });

    deformable.removePin(pin);

    expect(deformable.pins).toHaveLength(0);
    expect(deformable.points).toEqual(grid.points);
  });

  it('reset clears every pin and reverts to the base grid', () => {
    const grid = new Grid(config);
    const deformable = new DeformableGrid(grid);
    deformable.addPin({ referencePosition: grid.points[0], radius: 1000 });
    deformable.movePin(deformable.pins[0], { x: 999, y: 999 });

    deformable.reset();

    expect(deformable.pins).toHaveLength(0);
    expect(deformable.points).toEqual(grid.points);
  });

  it('findNearestPoint searches current (deformed), not base, positions', () => {
    const grid = new Grid(config);
    const deformable = new DeformableGrid(grid);
    const anchor = grid.points[0];
    const pin = deformable.addPin({ referencePosition: anchor, radius: 1000 });
    deformable.movePin(pin, { x: anchor.x + 500, y: anchor.y + 500 });

    // The base position no longer has any current nail sitting on it.
    expect(deformable.findNearestPoint(anchor, 1)).toBeNull();
  });

  describe('findNearestBaseNail (regression: creating a 2nd pin near a 1st used to be impossible)', () => {
    it('finds a nail by its current (deformed) position and returns its base position', () => {
      const grid = new Grid(config);
      const deformable = new DeformableGrid(grid);
      const anchor = grid.points[0];
      const otherBase = grid.points[1];
      const pin = deformable.addPin({ referencePosition: anchor, radius: 1000 });
      deformable.movePin(pin, { x: anchor.x + 100, y: anchor.y + 100 });

      // otherBase has also moved (radius 1000 covers the whole tiny test
      // grid) - clicking where it's now *displayed* must still resolve to
      // its base position, not fail because base-space search would miss.
      const displayedPosition = deformable.points[1];
      const found = deformable.findNearestBaseNail(displayedPosition, 1);
      expect(found).toEqual(otherBase);
    });

    it('a plain base-space search would have missed this (the bug being fixed)', () => {
      const grid = new Grid(config);
      const deformable = new DeformableGrid(grid);
      const anchor = grid.points[0];
      const pin = deformable.addPin({ referencePosition: anchor, radius: 1000 });
      deformable.movePin(pin, { x: anchor.x + 100, y: anchor.y + 100 });

      const displayedPosition = deformable.points[1];
      // Confirms the fix actually matters: the nail's base position is no
      // longer near where it's displayed.
      expect(grid.points[1].distanceTo(displayedPosition)).toBeGreaterThan(10);
      expect(deformable.findNearestBaseNail(displayedPosition, 10)).not.toBeNull();
    });

    it('returns null when nothing is within range', () => {
      const grid = new Grid(config);
      const deformable = new DeformableGrid(grid);
      expect(deformable.findNearestBaseNail({ x: 99999, y: 99999 }, 10)).toBeNull();
    });
  });

  describe('findNearestPin', () => {
    it('returns the truly nearest pin within range', () => {
      const grid = new Grid(config);
      const deformable = new DeformableGrid(grid);
      const near = deformable.addPin({ referencePosition: { x: 0, y: 2 } });
      deformable.addPin({ referencePosition: { x: 0, y: 8 } });

      expect(deformable.findNearestPin({ x: 0, y: 0 }, 10)).toBe(near);
    });

    it('returns null when nothing is within range', () => {
      const grid = new Grid(config);
      const deformable = new DeformableGrid(grid);
      deformable.addPin({ referencePosition: { x: 1000, y: 1000 } });
      expect(deformable.findNearestPin({ x: 0, y: 0 }, 10)).toBeNull();
    });
  });

  it('caches .points and only recomputes after a mutation', () => {
    const grid = new Grid(config);
    const deformable = new DeformableGrid(grid);
    const anchor = grid.points[0];
    const pin = deformable.addPin({ referencePosition: anchor, radius: 1000 });
    deformable.movePin(pin, { x: anchor.x + 10, y: anchor.y });

    const first = deformable.points;
    const second = deformable.points;
    expect(first).toBe(second); // same array reference - not recomputed

    deformable.movePin(pin, { x: anchor.x + 20, y: anchor.y });
    const third = deformable.points;
    expect(third).not.toBe(first);
    expect(third[0].x).toBeCloseTo(anchor.x + 20, 5);
  });

  it('invalidate() forces a recompute for a pin field mutated outside movePin/addPin (e.g. DeformationUI editing radius/falloff directly)', () => {
    const grid = new Grid(config);
    const deformable = new DeformableGrid(grid);
    const pin = deformable.addPin({ referencePosition: grid.points[0], radius: 10 });
    deformable.movePin(pin, { x: grid.points[0].x + 50, y: grid.points[0].y });

    const cached = deformable.points;
    expect(deformable.points).toBe(cached); // still cached, nothing changed

    pin.radius = 1000; // bypasses addPin/movePin/removePin's own invalidation
    deformable.invalidate();
    expect(deformable.points).not.toBe(cached); // forced to recompute
  });

  it('does not mutate the base Grid', () => {
    const grid = new Grid(config);
    const originalFirst = { x: grid.points[0].x, y: grid.points[0].y };
    const deformable = new DeformableGrid(grid);
    const pin = deformable.addPin({ referencePosition: grid.points[0], radius: 1000 });
    deformable.movePin(pin, { x: 9999, y: 9999 });

    expect(grid.points[0]).toEqual(originalFirst);
  });
});
