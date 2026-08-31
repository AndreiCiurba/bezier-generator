/**
 * Turns a flat list of grid nails (see `Grid.js`) into "cells" - the 3, 4,
 * or 6 nails that make up one repeating tile of the current layout - for
 * the Weave feature. `Grid` itself has no cell/face concept for any of its
 * four layouts, and reconstructing each one's exact lattice topology means
 * real, layout-specific geometry rather than one shared trick - `square`
 * (a plain rectangular nail grid) matches cells by exact coordinate,
 * `standard`/`rotated` (a triangular lattice) matches them by angular
 * neighbor-pairing at the lattice's own spacing, and `hexagon` (a honeycomb -
 * a triangular lattice with 1 of its 3 sublattices removed) matches them by
 * reconstructing each honeycomb hole's implied center (see
 * `enumerateAxisAlignedSquareCells`/`enumerateTriangularCells`/
 * `enumerateHexagonalCells`). Any side count outside {3,4,6} - not a real
 * `Grid` layout, but still nameable on a hand-edited `WeaveRecipe` - falls
 * back to a generic "nearest `sides` nails, wound into a polygon"
 * approximation (see `enumerateCells`'s own doc for what that approximation
 * costs). `findNearestCell` (a single from-a-click lookup, rather than a
 * whole-grid enumeration) still uses that same generic nearest-neighbor
 * approach for every shape - it isn't part of the app's actual click flow
 * anymore (`enumerateCells` + `nearestCellByCentroid` is), but stays exact-
 * shape-agnostic since nothing currently depends on it being precise.
 */

// Grid#layout -> how many nails make up one cell of that layout's lattice.
// 'standard'/'rotated' are both the same triangular lattice (see Grid.js);
// 'square' and 'hexagon' are their own thing. Falls back to 3 (triangle) for
// an unrecognized layout, matching Grid's own `#buildRotated()` fallback.
const SIDES_FOR_LAYOUT = { standard: 3, rotated: 3, square: 4, hexagon: 6 };
const SHAPE_NAME_FOR_LAYOUT = { standard: 'Triangle', rotated: 'Triangle', square: 'Square', hexagon: 'Hexagon' };

/** How many nails make up one cell of the given `Grid#layout`. @param {string} layout @returns {number} */
export function sidesForGridLayout(layout) {
  return SIDES_FOR_LAYOUT[layout] ?? 3;
}

/** A human-readable shape name for the given `Grid#layout` - the Weave menu's auto-detected shape label. @param {string} layout @returns {string} */
export function shapeNameForGridLayout(layout) {
  return SHAPE_NAME_FOR_LAYOUT[layout] ?? 'Triangle';
}

// The reverse direction of SHAPE_NAME_FOR_LAYOUT - a plain side count (as
// saved on a WeaveRecipe, not tied to any particular Grid#layout) to a
// human-readable name. Falls back to "N-gon" for shapes the app's own Grid
// doesn't support yet (5, 7, 8, ...) - a recipe designed at one of those in
// the standalone playground is still nameable/importable, just flagged as a
// shape mismatch against whatever grid it's used on (see WeaveUI's import flow).
const SHAPE_NAME_FOR_SIDES = { 3: 'Triangle', 4: 'Square', 6: 'Hexagon' };

/** A human-readable shape name for a plain side count - used for `WeaveRecipe#sides`, which isn't tied to any particular `Grid#layout`. @param {number} sides @returns {string} */
export function shapeNameForSides(sides) {
  return SHAPE_NAME_FOR_SIDES[sides] ?? `${sides}-gon`;
}

/**
 * A stable identity key for a cell, derived purely from its own corner
 * positions (rounded to two decimal places to absorb float noise) rather
 * than object identity or winding order - the same physical cell always
 * produces the same id regardless of which corner `findNearestCell`/
 * `enumerateCells` happened to start winding from. Used exactly like
 * `patternId` is used today, to answer "does a weave curve already exist
 * for this cell" (see `Curve#belongsToCell`, `CurveStore#hasCurveForCell`).
 * @param {{x:number,y:number}[]} cellCorners
 * @returns {string}
 */
export function cellIdForCorners(cellCorners) {
  return cellCorners
    .map((p) => `${Math.round(p.x * 100) / 100},${Math.round(p.y * 100) / 100}`)
    .sort()
    .join('|');
}

/**
 * Sorts `points` into a simple (non-self-intersecting) winding order around
 * their own centroid - turns "these are the `sides` nearest nails" into an
 * actual polygon rather than a set that might zig-zag if left in
 * distance-sorted order.
 * @param {{x:number,y:number}[]} points
 * @returns {{x:number,y:number}[]}
 */
function sortByAngleAroundCentroid(points) {
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  return [...points].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
}

/**
 * The `sides` nails nearest `worldPos`, wound into a simple polygon - the
 * cell a click at `worldPos` should be considered to have hit. `null` if
 * fewer than `sides` points exist at all, or if the farthest of the chosen
 * nails is beyond `maxRadius` (a plain click near empty space, or near the
 * boundary of a grid too small for this shape, shouldn't silently grab
 * whatever's nearest no matter how far away it actually is).
 * @param {{x:number,y:number, distanceTo: (p:{x:number,y:number}) => number}[]} points
 * @param {{x:number,y:number}} worldPos
 * @param {number} sides
 * @param {number} [maxRadius]
 * @returns {typeof points | null}
 */
export function findNearestCell(points, worldPos, sides, maxRadius = Infinity) {
  if (points.length < sides) return null;

  const nearest = [...points].sort((a, b) => a.distanceTo(worldPos) - b.distanceTo(worldPos)).slice(0, sides);
  const farthest = nearest[nearest.length - 1].distanceTo(worldPos);
  if (farthest > maxRadius) return null;

  return sortByAngleAroundCentroid(nearest);
}

/** Rounds to 2 decimal places and stringifies, for float-safe coordinate-bucket keys (mirrors `cellIdForCorners`'s own rounding). @param {number} x @param {number} y @returns {string} */
function coordKey(x, y) {
  return `${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`;
}

/**
 * Every axis-aligned unit square in a *dense, axis-aligned rectangular*
 * lattice (Grid.js's `square` layout - see `Grid.js#buildSquareTiled`) -
 * exact index math instead of nearest-neighbor guessing, since this lattice
 * has none of the ambiguity a guess would need to resolve: bucket the
 * distinct X's and Y's actually present, then take every pair of
 * *immediately adjacent* ones (columns 0-1, 1-2, 2-3, ...; rows 0-1, 1-2,
 * 2-3, ...) as one cell - so consecutive cells directly touch, sharing a
 * full edge (2 nails) with each neighbor, the way real graph-paper squares
 * do (see `docs/image copy.png`) - not a "gap" cell's width apart. This
 * deliberately means a nail belongs to as many as 4 cells at once (its own
 * cell plus the ones sharing each of its edges/corner) rather than exactly
 * one - unlike triangle/hexagon's own disjoint-tiling cells below, which is
 * fine: this is the one shape in the app meant to read as an unbroken grid
 * of touching squares, not independent tiles.
 * @param {{x:number,y:number}[]} points
 * @returns {{x:number,y:number}[][]}
 */
function enumerateAxisAlignedSquareCells(points) {
  const byCoord = new Map();
  for (const p of points) byCoord.set(coordKey(p.x, p.y), p);

  const xs = [...new Set(points.map((p) => Math.round(p.x * 100) / 100))].sort((a, b) => a - b);
  const ys = [...new Set(points.map((p) => Math.round(p.y * 100) / 100))].sort((a, b) => a - b);

  const cells = [];
  for (let yi = 0; yi + 1 < ys.length; yi++) {
    for (let xi = 0; xi + 1 < xs.length; xi++) {
      const [x0, x1] = [xs[xi], xs[xi + 1]];
      const [y0, y1] = [ys[yi], ys[yi + 1]];
      const corners = [
        byCoord.get(coordKey(x0, y0)),
        byCoord.get(coordKey(x1, y0)),
        byCoord.get(coordKey(x1, y1)),
        byCoord.get(coordKey(x0, y1)),
      ];
      if (corners.every(Boolean)) cells.push(corners);
    }
  }
  return cells;
}

/**
 * The lattice's own nail-to-nail spacing - the minimum distance between any
 * two distinct points. Every exact (non-greedy) cell-detection path below
 * needs this as its "what counts as touching" tolerance, since unlike
 * `enumerateAxisAlignedSquareCells` (which can match nails by exact
 * coordinate), a triangular lattice's row-parity stagger means two adjacent
 * nails essentially never share an X or a Y - only their distance apart is
 * ever exactly `spacing`.
 * @param {{x:number,y:number, distanceTo: (p:{x:number,y:number}) => number}[]} points
 * @returns {number}
 */
function latticeSpacing(points) {
  let min = Infinity;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = points[i].distanceTo(points[j]);
      if (d < min) min = d;
    }
  }
  return min;
}

/**
 * Every small equilateral triangle in a triangular lattice (Grid.js's
 * `standard`/`rotated` layouts) - exact geometry instead of nearest-neighbor
 * guessing, the triangle equivalent of `enumerateAxisAlignedSquareCells`.
 *
 * The key fact this leans on: for any point `P` and two of its lattice
 * neighbors `A`/`B` (both at the lattice spacing `s` from `P`) that are 60°
 * apart as seen from `P`, `A` and `B` are *also* exactly `s` apart from each
 * other - `P`/`A`/`B` form a real equilateral triangle. In a triangular
 * lattice every interior point has up to 6 such neighbors spaced 60° apart
 * all the way around, so walking each point's neighbors in angular order and
 * pairing up consecutive ones (wrapping around) finds every small triangle
 * touching that point - up/down-pointing alike, and it degrades safely at
 * the grid's boundary: a missing neighbor just means a wider angular gap
 * there, whose two flanking neighbors are more than `s` apart and so never
 * form a false triangle. Each real triangle gets found once from each of its
 * 3 corners, so `cellIdForCorners` dedupes down to the true cell list.
 * @param {{x:number,y:number, distanceTo: (p:{x:number,y:number}) => number}[]} points
 * @returns {typeof points[]}
 */
function enumerateTriangularCells(points) {
  if (points.length < 3) return [];

  const spacing = latticeSpacing(points);
  const tolerance = spacing * 0.05; // absorbs float noise without conflating spacing with the next lattice tier (s*sqrt(3), s*2, ...)
  const seen = new Set();
  const cells = [];

  for (const p of points) {
    const neighbors = points
      .filter((q) => q !== p && Math.abs(p.distanceTo(q) - spacing) < tolerance)
      .sort((a, b) => Math.atan2(a.y - p.y, a.x - p.x) - Math.atan2(b.y - p.y, b.x - p.x));

    for (let i = 0; i < neighbors.length; i++) {
      const a = neighbors[i];
      const b = neighbors[(i + 1) % neighbors.length];
      if (Math.abs(a.distanceTo(b) - spacing) > tolerance) continue; // a boundary gap - no 3rd corner on this side

      const id = cellIdForCorners([p, a, b]);
      if (seen.has(id)) continue;
      seen.add(id);
      cells.push(sortByAngleAroundCentroid([p, a, b]));
    }
  }

  return cells;
}

/**
 * Rotates `point` around `center` by `angleRadians` (standard math-positive,
 * counterclockwise-in-a-Y-up frame - which axis actually points "up" on
 * screen never matters here, only that every call uses the same convention
 * consistently). A tiny local helper rather than pulling in a general
 * vector/matrix utility just for this one use.
 * @param {{x:number,y:number}} center
 * @param {{x:number,y:number}} point
 * @param {number} angleRadians
 * @returns {{x:number,y:number}}
 */
function rotateAround(center, point, angleRadians) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const cos = Math.cos(angleRadians);
  const sin = Math.sin(angleRadians);
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
}

/**
 * The 2 points that would complete an equilateral triangle of side `spacing`
 * on `p`/`q` (one on each side of segment `p`-`q`) - candidate honeycomb-hole
 * centers for `enumerateHexagonalCells` below, found by offsetting the
 * segment's midpoint along its perpendicular by the triangle's own height.
 * @param {{x:number,y:number}} p
 * @param {{x:number,y:number}} q
 * @param {number} spacing
 * @returns {{x:number,y:number}[]}
 */
function equilateralApexCandidates(p, q, spacing) {
  const midX = (p.x + q.x) / 2;
  const midY = (p.y + q.y) / 2;
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  const height = (spacing * Math.sqrt(3)) / 2;
  const perpX = (-dy / len) * height;
  const perpY = (dx / len) * height;
  return [
    { x: midX + perpX, y: midY + perpY },
    { x: midX - perpX, y: midY - perpY },
  ];
}

/**
 * Every hexagon in a honeycomb lattice (Grid.js's `hexagon` layout - a
 * triangular lattice with 1 of its 3 sublattices removed, see
 * `Grid.js#buildHexagon`'s own doc) - exact geometry instead of nearest-
 * neighbor guessing, the hexagon equivalent of `enumerateAxisAlignedSquareCells`/
 * `enumerateTriangularCells`.
 *
 * The lattice fact this leans on: every remaining nail still has exactly 3
 * neighbors at the *original* triangular lattice's spacing `s` (dropping one
 * color class costs each survivor half its neighbors, not its own position).
 * Each hexagonal "hole" left by a removed nail is bordered by exactly 6
 * survivors, arranged around that hole's implied center at 60° increments
 * and `s` apart from it - i.e. an equilateral triangle on any surviving edge
 * `P`-`Q` has its apex sitting exactly on one of these implied centers. So
 * for every edge `P`-`Q` (nails at distance `s`), build both candidate
 * apexes (`equilateralApexCandidates`), then for each one check whether
 * rotating `P` around it by 0/60/120/180/240/300° lands on 6 *real* nails -
 * if so, that's a genuine hexagon, already wound in order by construction.
 * Every real hexagon gets found from several of its own edges, so
 * `cellIdForCorners` dedupes down to the true cell list, the same pattern
 * `enumerateTriangularCells` uses.
 * @param {{x:number,y:number, distanceTo: (p:{x:number,y:number}) => number}[]} points
 * @returns {typeof points[]}
 */
function enumerateHexagonalCells(points) {
  if (points.length < 6) return [];

  const spacing = latticeSpacing(points);
  const tolerance = spacing * 0.05;

  const findNear = (x, y) => {
    for (const p of points) {
      if (Math.hypot(p.x - x, p.y - y) < tolerance) return p;
    }
    return null;
  };

  const seen = new Set();
  const cells = [];

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const p = points[i];
      const q = points[j];
      if (Math.abs(p.distanceTo(q) - spacing) > tolerance) continue;

      for (const center of equilateralApexCandidates(p, q, spacing)) {
        const corners = [];
        for (let k = 0; k < 6; k++) {
          const rotated = rotateAround(center, p, (k * Math.PI) / 3);
          const match = findNear(rotated.x, rotated.y);
          if (!match) break;
          corners.push(match);
        }
        if (corners.length !== 6) continue;

        const id = cellIdForCorners(corners);
        if (seen.has(id)) continue;
        seen.add(id);
        cells.push(corners);
      }
    }
  }

  return cells;
}

/**
 * Every cell of the given shape across the whole grid, for Auto mode's
 * "populate everywhere at once" (and for building the population
 * `cellsWithinNeighborRadius` walks). Every shape the app's own `Grid` can
 * produce now has an exact geometric construction, no guessing involved:
 * `sides === 4` (`square`) goes through `enumerateAxisAlignedSquareCells`'s
 * exact index math, `sides === 3` (`standard`/`rotated`) goes through
 * `enumerateTriangularCells`'s exact angular-neighbor-pairing, and
 * `sides === 6` (`hexagon`) goes through `enumerateHexagonalCells`'s exact
 * honeycomb-hole reconstruction. Any *other* side count (there's no such
 * `Grid` layout today, but a hand-edited `WeaveRecipe` could still name one -
 * see that model's own doc) falls back to a greedy, approximate pass: take
 * each not-yet-used nail in turn, pull its `sides - 1` nearest not-yet-used
 * neighbors to complete a cell, mark all `sides` of them used, and move on;
 * a nail without enough not-yet-used neighbors left (near the grid's
 * boundary, or already used up by an earlier cell) is skipped rather than
 * forced into a cell. That fallback isn't a mathematically exact tiling -
 * two adjacent, equally-valid cells can compete for the same nail (whichever
 * nail happens earlier in `points` wins it), which can occasionally chain
 * into a visibly wrong shape a few cells over - the same class of bug
 * square/triangle/hexagon each had before they got their own exact paths.
 * @param {{x:number,y:number, distanceTo: (p:{x:number,y:number}) => number}[]} points
 * @param {number} sides
 * @returns {typeof points[]}
 */
export function enumerateCells(points, sides) {
  if (sides === 4) return enumerateAxisAlignedSquareCells(points);
  if (sides === 3) return enumerateTriangularCells(points);
  if (sides === 6) return enumerateHexagonalCells(points);

  const used = new Set();
  const cells = [];

  for (const anchor of points) {
    if (used.has(anchor)) continue;

    const candidates = points.filter((p) => p !== anchor && !used.has(p));
    if (candidates.length < sides - 1) continue;

    const neighbors = candidates
      .sort((a, b) => a.distanceTo(anchor) - b.distanceTo(anchor))
      .slice(0, sides - 1);

    const cell = sortByAngleAroundCentroid([anchor, ...neighbors]);
    cell.forEach((p) => used.add(p));
    cells.push(cell);
  }

  return cells;
}

/** A cell's own center point - the average of its corners. @param {{x:number,y:number}[]} cell @returns {{x:number,y:number}} */
function cellCentroid(cell) {
  const x = cell.reduce((sum, p) => sum + p.x, 0) / cell.length;
  const y = cell.reduce((sum, p) => sum + p.y, 0) / cell.length;
  return { x, y };
}

/**
 * The cell (from a full tiling, e.g. `enumerateCells`'s own output) whose
 * center is nearest `worldPos` - the Weave feature's Manual-mode click
 * target once a neighborhood radius is in play (see
 * `cellsWithinNeighborRadius`), which needs a click to resolve to one member
 * of a *specific, shared* population of cells rather than an independent
 * per-click `findNearestCell` query, so its neighbors can be looked up
 * against that same population. `null` if `cells` is empty or the nearest
 * center is beyond `maxRadius`.
 * @param {{x:number,y:number}[][]} cells
 * @param {{x:number,y:number}} worldPos
 * @param {number} [maxRadius]
 * @returns {{x:number,y:number}[] | null}
 */
export function nearestCellByCentroid(cells, worldPos, maxRadius = Infinity) {
  let best = null;
  let bestDist = Infinity;
  for (const cell of cells) {
    const c = cellCentroid(cell);
    const d = Math.hypot(c.x - worldPos.x, c.y - worldPos.y);
    if (d < bestDist) {
      bestDist = d;
      best = cell;
    }
  }
  return best && bestDist <= maxRadius ? best : null;
}

// How much farther than a cell's own nearest-neighbor distance still counts
// as "touching" it, when building the adjacency graph below. Loose enough to
// catch a diagonal neighbor in a square packing (sqrt(2) ≈ 1.41x the
// orthogonal spacing) or the slightly uneven spacing `enumerateCells`'s
// greedy, non-exact tiling can leave behind, tight enough that a cell across
// an actual gap (2x+ the local spacing) never gets pulled in.
const TOUCHING_TOLERANCE = 1.5;

/**
 * An adjacency graph over `cells`: cell `i` is linked to cell `j` when their
 * centers are within `TOUCHING_TOLERANCE` of *either* cell's own nearest-
 * neighbor distance - i.e. "close enough that, locally, nothing else is much
 * closer". Using each cell's own local spacing (rather than one grid-wide
 * distance) keeps this correct even where `enumerateCells`'s greedy, non-
 * exact tiling leaves the lattice slightly uneven, and works unmodified for
 * triangle/square/hexagon packings alike since none of it assumes a
 * particular neighbor count or direction.
 * @param {{x:number,y:number}[][]} cells
 * @returns {number[][]} `adjacency[i]` is the list of indices touching cell `i`
 */
function buildTouchingGraph(cells) {
  const centroids = cells.map(cellCentroid);
  const n = centroids.length;

  const nearestDist = centroids.map((c, i) => {
    let best = Infinity;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const d = Math.hypot(c.x - centroids[j].x, c.y - centroids[j].y);
      if (d < best) best = d;
    }
    return best;
  });

  const adjacency = cells.map(() => []);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = Math.hypot(centroids[i].x - centroids[j].x, centroids[i].y - centroids[j].y);
      const threshold = Math.min(nearestDist[i], nearestDist[j]) * TOUCHING_TOLERANCE;
      if (d <= threshold) {
        adjacency[i].push(j);
        adjacency[j].push(i);
      }
    }
  }
  return adjacency;
}

/**
 * `targetCell` plus every cell reachable within `radius` hops of the
 * "touching" adjacency graph built by `buildTouchingGraph` - the Weave
 * menu's Manual-mode neighborhood-radius brush. Walking actual touching
 * adjacency (rather than picking the N globally-nearest cells by raw
 * distance) is what keeps this a tight, contiguous blob around the click -
 * on a square packing that comes out to the familiar Moore neighborhood
 * (radius 1 → 8, radius 2 → 24), and the same hop-based walk holds up on
 * triangle/hexagon tilings and on `enumerateCells`'s occasionally uneven
 * output, where a naive "nearest by distance" pass could reach right past a
 * missing local cell to grab a genuinely distant one instead.
 * @param {{x:number,y:number}[][]} cells the full tiling `targetCell` came from (e.g. `enumerateCells`'s output)
 * @param {{x:number,y:number}[]} targetCell
 * @param {number} radius 0 returns just `targetCell` itself
 * @returns {{x:number,y:number}[][]}
 */
export function cellsWithinNeighborRadius(cells, targetCell, radius) {
  if (radius <= 0) return [targetCell];

  const targetIndex = cells.indexOf(targetCell);
  if (targetIndex === -1) return [targetCell];

  const adjacency = buildTouchingGraph(cells);
  const visited = new Set([targetIndex]);
  let frontier = [targetIndex];
  for (let step = 0; step < radius; step++) {
    const next = [];
    for (const idx of frontier) {
      for (const neighborIdx of adjacency[idx]) {
        if (!visited.has(neighborIdx)) {
          visited.add(neighborIdx);
          next.push(neighborIdx);
        }
      }
    }
    frontier = next;
  }

  return [...visited].map((idx) => cells[idx]);
}
