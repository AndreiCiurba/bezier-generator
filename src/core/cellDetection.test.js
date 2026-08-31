import { describe, it, expect } from 'vitest';
import { Point } from './Point.js';
import {
  findNearestCell,
  enumerateCells,
  sidesForGridLayout,
  shapeNameForGridLayout,
  shapeNameForSides,
  cellIdForCorners,
  nearestCellByCentroid,
  cellsWithinNeighborRadius,
} from './cellDetection.js';

// A 5x5 grid of square cells (16 cells, each a unit square), laid out so
// each cell's own centroid sits at (col + 0.5, row + 0.5) - i.e. exactly a
// square grid's own natural cell-center spacing, for testing neighbor-ring
// math against known Moore-neighborhood counts.
function squareCellGrid(size) {
  const cells = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      cells.push([
        new Point(col, row),
        new Point(col + 1, row),
        new Point(col + 1, row + 1),
        new Point(col, row + 1),
      ]);
    }
  }
  return cells;
}

describe('shapeNameForSides', () => {
  it('names the three shapes the app\'s own Grid supports', () => {
    expect(shapeNameForSides(3)).toBe('Triangle');
    expect(shapeNameForSides(4)).toBe('Square');
    expect(shapeNameForSides(6)).toBe('Hexagon');
  });

  it('falls back to "N-gon" for a shape Grid does not support yet', () => {
    expect(shapeNameForSides(5)).toBe('5-gon');
    expect(shapeNameForSides(8)).toBe('8-gon');
  });
});

describe('cellIdForCorners', () => {
  it('is independent of winding order/starting corner', () => {
    const a = [new Point(0, 0), new Point(10, 0), new Point(10, 10), new Point(0, 10)];
    const b = [new Point(10, 10), new Point(0, 10), new Point(0, 0), new Point(10, 0)]; // same corners, rotated
    expect(cellIdForCorners(a)).toBe(cellIdForCorners(b));
  });

  it('differs for a genuinely different cell', () => {
    const a = [new Point(0, 0), new Point(10, 0), new Point(10, 10)];
    const b = [new Point(0, 0), new Point(10, 0), new Point(20, 20)];
    expect(cellIdForCorners(a)).not.toBe(cellIdForCorners(b));
  });
});

describe('sidesForGridLayout / shapeNameForGridLayout', () => {
  it('maps standard/rotated to a 3-sided triangle cell', () => {
    expect(sidesForGridLayout('standard')).toBe(3);
    expect(sidesForGridLayout('rotated')).toBe(3);
    expect(shapeNameForGridLayout('standard')).toBe('Triangle');
  });

  it('maps square to a 4-sided cell and hexagon to a 6-sided cell', () => {
    expect(sidesForGridLayout('square')).toBe(4);
    expect(sidesForGridLayout('hexagon')).toBe(6);
    expect(shapeNameForGridLayout('square')).toBe('Square');
    expect(shapeNameForGridLayout('hexagon')).toBe('Hexagon');
  });

  it('falls back to triangle for an unrecognized layout, matching Grid#buildRotated\'s own fallback', () => {
    expect(sidesForGridLayout('bogus')).toBe(3);
    expect(shapeNameForGridLayout('bogus')).toBe('Triangle');
  });
});

describe('findNearestCell', () => {
  it('returns null when fewer points exist than sides', () => {
    const points = [new Point(0, 0), new Point(10, 0)];
    expect(findNearestCell(points, new Point(5, 0), 4)).toBeNull();
  });

  it('returns null when the farthest of the nearest `sides` points exceeds maxRadius', () => {
    const points = [new Point(0, 0), new Point(100, 0), new Point(0, 100), new Point(100, 100)];
    expect(findNearestCell(points, new Point(50, 50), 4, 10)).toBeNull();
  });

  it('winds a square cell into an actual perimeter, not a crossing (bowtie) order', () => {
    // Deliberately given in a shuffled, non-winding-friendly order.
    const points = [new Point(10, 10), new Point(0, 0), new Point(10, 0), new Point(0, 10)];
    const cell = findNearestCell(points, new Point(5, 5), 4);
    expect(cell).toHaveLength(4);
    let perimeter = 0;
    for (let i = 0; i < cell.length; i++) {
      perimeter += cell[i].distanceTo(cell[(i + 1) % cell.length]);
    }
    // A proper winding of a 10x10 square has perimeter 40; a crossing
    // (diagonal-adjacent) order would sum to two diagonals + two sides,
    // roughly 2*14.14 + 2*10 = ~48.3 - a strictly larger number either way.
    expect(perimeter).toBeCloseTo(40, 5);
  });

  it('picks the nearest `sides` points, ignoring farther ones', () => {
    const near = [new Point(0, 0), new Point(1, 0), new Point(0, 1)];
    const far = new Point(1000, 1000);
    const cell = findNearestCell([...near, far], new Point(0.3, 0.3), 3);
    expect(cell).not.toContain(far);
  });
});

describe('nearestCellByCentroid', () => {
  it('returns the cell whose centroid is closest to worldPos', () => {
    const cells = squareCellGrid(5);
    // The cell at (col=2,row=2) has centroid (2.5, 2.5).
    const found = nearestCellByCentroid(cells, { x: 2.6, y: 2.4 });
    expect(found).toEqual(cells[2 * 5 + 2]);
  });

  it('returns null when nothing is within maxRadius', () => {
    const cells = squareCellGrid(5);
    expect(nearestCellByCentroid(cells, { x: 100, y: 100 }, 5)).toBeNull();
  });

  it('returns null for an empty cell list', () => {
    expect(nearestCellByCentroid([], { x: 0, y: 0 })).toBeNull();
  });
});

describe('cellsWithinNeighborRadius', () => {
  it('radius 0 returns just the target cell', () => {
    const cells = squareCellGrid(5);
    const target = cells[12]; // center of the 5x5 grid
    expect(cellsWithinNeighborRadius(cells, target, 0)).toEqual([target]);
  });

  it('radius 1 returns the target plus its 8 nearest neighbors (Moore neighborhood)', () => {
    const cells = squareCellGrid(5);
    const target = cells[2 * 5 + 2]; // center cell, fully surrounded
    const result = cellsWithinNeighborRadius(cells, target, 1);
    expect(result).toHaveLength(9);
    expect(result[0]).toBe(target);
  });

  it('radius 2 returns the target plus its 24 nearest neighbors', () => {
    const cells = squareCellGrid(5);
    const target = cells[2 * 5 + 2];
    const result = cellsWithinNeighborRadius(cells, target, 2);
    expect(result).toHaveLength(25);
  });

  it('never includes the target cell twice, even among the neighbors', () => {
    const cells = squareCellGrid(5);
    const target = cells[2 * 5 + 2];
    const result = cellsWithinNeighborRadius(cells, target, 2);
    expect(result.filter((c) => c === target)).toHaveLength(1);
  });

  it('stays a tight local cluster on a gapped tiling, never reaching past a missing neighbor to a distant cell', () => {
    // Mirrors docs/image.png: a 3x3 block of cells with real gaps between
    // them (spacing 3 within the block), then one lone cell far off to the
    // side (spacing 3 away from the block, but much farther than any
    // in-block neighbor). Picking "nearest by raw distance" would still
    // (wrongly) reach for that lone cell once a radius ring runs out of true
    // neighbors; walking touching-adjacency should never include it.
    const cells = squareCellGrid(3).map((cell) => cell.map((p) => new Point(p.x * 3, p.y * 3)));
    const farAway = [
      new Point(100, 0), new Point(101, 0), new Point(101, 1), new Point(100, 1),
    ];
    const allCells = [...cells, farAway];
    const center = cells[1 * 3 + 1]; // center of the 3x3 block

    const ring1 = cellsWithinNeighborRadius(allCells, center, 1);
    expect(ring1).toHaveLength(9); // the whole 3x3 block, itself included
    expect(ring1).not.toContain(farAway);

    const ring2 = cellsWithinNeighborRadius(allCells, center, 2);
    expect(ring2).not.toContain(farAway); // still unreachable - there's nothing to hop through
  });

  it('never selects a cell that does not actually touch the target, even at a generous radius', () => {
    const cells = squareCellGrid(3);
    const farAway = [
      new Point(100, 0), new Point(101, 0), new Point(101, 1), new Point(100, 1),
    ];
    const allCells = [...cells, farAway];
    const corner = cells[0]; // corner cell of the 3x3 block, only 3 true neighbors

    const result = cellsWithinNeighborRadius(allCells, corner, 5);
    expect(result).toHaveLength(9); // saturates at the whole connected block
    expect(result).not.toContain(farAway);
  });

  it('fills solid - end to end on a real square-lattice enumerateCells() population, not just a hollow ring', () => {
    // Exactly what App.js/ThreeApp.js#handleWeaveClick actually does: run
    // enumerateCells over a real, odd-sized square lattice, find the
    // clicked cell, then ask for its neighborhood. A "nearest by centroid"
    // approach could end up with only the outer ring, missing the center -
    // this asserts the whole 3x3/5x5 block comes back solid.
    const points = [];
    for (let row = 0; row < 13; row++) {
      for (let col = 0; col < 13; col++) points.push(new Point(col * 60, row * 60));
    }
    const allCells = enumerateCells(points, 4);
    const target = nearestCellByCentroid(allCells, { x: 6 * 60 + 30, y: 6 * 60 + 30 });

    expect(cellsWithinNeighborRadius(allCells, target, 1)).toHaveLength(9);
    expect(cellsWithinNeighborRadius(allCells, target, 2)).toHaveLength(25);
  });
});

describe('enumerateCells', () => {
  it('returns one cell using every point when there are exactly `sides` of them', () => {
    const points = [new Point(0, 0), new Point(10, 0), new Point(10, 10), new Point(0, 10)];
    const cells = enumerateCells(points, 4);
    expect(cells).toHaveLength(1);
    expect(cells[0]).toHaveLength(4);
  });

  it('never lets two cells share a point, for a shape whose lattice needs disjoint tiles (triangle/hexagon)', () => {
    // sides !== 4 still goes through the generic greedy-nearest-neighbors
    // path, which is meant to produce disjoint tiles - unlike sides === 4's
    // deliberately-overlapping dense squares (see the "sides === 4" describe
    // block below).
    const points = [];
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 6; col++) points.push(new Point(col * 10, row * 10));
    }
    const cells = enumerateCells(points, 3);
    const seen = new Set();
    for (const cell of cells) {
      for (const p of cell) {
        expect(seen.has(p)).toBe(false);
        seen.add(p);
      }
    }
  });

  it('skips leftover points that cannot form a full cell', () => {
    const points = [new Point(0, 0), new Point(10, 0), new Point(10, 10), new Point(0, 10), new Point(100, 100)];
    const cells = enumerateCells(points, 4);
    expect(cells).toHaveLength(1); // the 5th point is stranded alone, not enough left to form a 2nd cell
  });

  it('returns no cells when there are not enough points for even one', () => {
    const points = [new Point(0, 0), new Point(10, 0)];
    expect(enumerateCells(points, 4)).toEqual([]);
  });

  describe('sides === 4 (Grid Shape "Square") on an odd-sized dense rectangular lattice', () => {
    // A regression case: the old nearest-3-neighbors greedy grouping (still
    // used below for sides !== 4) could, on an odd row/column count, have
    // one anchor's "diagonal" pick reach across into a neighboring column
    // whose own natural partner had already been consumed elsewhere -
    // producing a degenerate, non-square quad a few cells over from any
    // actual boundary. A real (odd x odd) Grid.js 'square' lattice - see
    // Grid.js#buildSquareTiled - is what actually surfaced it.
    function denseSquareLattice(rows, cols, spacing) {
      const points = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) points.push(new Point(col * spacing, row * spacing));
      }
      return points;
    }

    it('produces only proper axis-aligned unit squares, never a degenerate quad', () => {
      const spacing = 60;
      const points = denseSquareLattice(13, 13, spacing);
      const cells = enumerateCells(points, 4);
      expect(cells.length).toBeGreaterThan(0);

      for (const cell of cells) {
        const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
        const edges = [d(cell[0], cell[1]), d(cell[1], cell[2]), d(cell[2], cell[3]), d(cell[3], cell[0])];
        for (const edge of edges) expect(edge).toBeCloseTo(spacing, 5);
        expect(d(cell[0], cell[2])).toBeCloseTo(spacing * Math.SQRT2, 5); // the diagonal
      }
    });

    it('produces exactly (rows-1) x (cols-1) cells - one per gap between adjacent nails, not one per pair of nails', () => {
      const points = denseSquareLattice(13, 13, 60);
      const cells = enumerateCells(points, 4);
      expect(cells).toHaveLength(12 * 12);
    });

    it('shares a full edge (2 nails) with each immediate neighbor - deliberately touching, not disjoint tiles (see docs/image copy.png)', () => {
      const points = denseSquareLattice(13, 13, 60);
      const cells = enumerateCells(points, 4);

      const cellAt = (col, row) => cells.find((c) => c.some((p) => p.x === col * 60 && p.y === row * 60) && c.some((p) => p.x === (col + 1) * 60 && p.y === (row + 1) * 60));
      const first = cellAt(0, 0);
      const rightNeighbor = cellAt(1, 0);
      expect(first).toBeDefined();
      expect(rightNeighbor).toBeDefined();

      const shared = first.filter((p) => rightNeighbor.includes(p));
      expect(shared).toHaveLength(2); // the whole shared edge, not just a corner
    });
  });
});
