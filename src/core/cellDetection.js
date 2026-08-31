/**
 * Turns a flat list of grid nails (see `Grid.js`) into "cells" - the 3, 4,
 * or 6 nails that make up one repeating tile of the current layout - for
 * the Weave feature. `Grid` itself has no cell/face concept for any of its
 * four layouts (`standard`/`rotated` are a triangular lattice, `square` is
 * concentric rings, `hexagon` is a honeycomb with a non-uniform boundary),
 * and reconstructing exact per-layout lattice topology would mean bespoke
 * code duplicated per layout, kept in sync with `Grid`'s own row/col math
 * forever after. Instead this works purely geometrically, off whatever
 * points are actually there: "the `sides` nearest nails to a point, wound
 * into a simple polygon" - which handles all four layouts (including
 * `square`'s non-uniform rings and the boundary of any layout) uniformly,
 * at the cost of being an approximation rather than an exact tiling (see
 * `enumerateCells`'s own doc for what that costs Auto mode specifically).
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
 * Every cell of the given shape across the whole grid, for Auto mode's
 * "populate everywhere at once" (and for building the population
 * `cellsWithinNeighborRadius` walks). `sides === 4` (Grid's `square`
 * layout, the only 4-sided shape this app has) goes through
 * `enumerateAxisAlignedSquareCells`'s exact index math, since that lattice
 * is a plain rectangular grid with no ambiguity to resolve. Everything else
 * (triangle/hexagon) uses a greedy pass instead: take each not-yet-used
 * nail in turn, pull its `sides - 1` nearest not-yet-used neighbors to
 * complete a cell, mark all `sides` of them used, and move on; a nail
 * without enough not-yet-used neighbors left (near the grid's boundary, or
 * already used up by an earlier cell) is skipped rather than forced into a
 * cell.
 *
 * That greedy path is an approximation, not a mathematically exact
 * non-overlapping tiling - two adjacent, equally-valid cells can compete for
 * the same nail (whichever nail happens earlier in `points` wins it), which
 * can occasionally chain into a visibly wrong shape a few cells over. It's
 * kept for triangle/hexagon since reconstructing their exact per-layout
 * lattice topology is real, layout-specific work (their nails have a
 * row-parity stagger a simple coordinate bucket can't untangle) - a
 * follow-up if it ever turns out to matter there too.
 * @param {{x:number,y:number, distanceTo: (p:{x:number,y:number}) => number}[]} points
 * @param {number} sides
 * @returns {typeof points[]}
 */
export function enumerateCells(points, sides) {
  if (sides === 4) return enumerateAxisAlignedSquareCells(points);

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
