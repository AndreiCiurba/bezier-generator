import { subdivide } from './weaveMath.js';

/**
 * Closed-polygon "leap weave" - a generalization of `computeWeaveSegments`
 * (see `weaveMath.js`) to a full N-gon perimeter instead of one open
 * triplet. Ported unchanged from the validated prototype
 * (`tools/leap-weave-playground.html`), built for the Weave feature.
 *
 * Each edge of the polygon owns `n + 1` points: its own start corner
 * (index 0) plus `n` inner nails (indices 1..n) - the far corner belongs to
 * the *next* edge as *its* point 0, so corners are never double-counted.
 * Nail `p` on edge `i` connects to nail `p + leap` on the next edge,
 * overflowing into however many further edges it takes rather than
 * stopping after one triplet - equivalently, number every point once
 * around the whole perimeter (`total = (n + 1) * sides`) and connect global
 * point `g` to `g + (n + 1) + leap` (mod `total`). `leap = 0` reproduces
 * the same fan-from-a-shared-corner shape `computeWeaveSegments` already
 * draws for two edges, just stretched around every edge of a closed shape
 * instead of stopping after two.
 *
 * One color layer `i` (0-based) uses `leap - i`, mirroring how
 * `computeWeaveSegments`'s own `layerIndex` shifts each subsequent color's
 * connection back by one step - so color 0 uses `leap`, color 1 uses
 * `leap - 1`, and so on.
 */

/**
 * Each edge's own point list: `[corner, inner1, ..., innerN]` - `n + 1`
 * points, corner-inclusive of only its own start (see class doc above for
 * why the far corner isn't repeated here).
 * @param {{x:number,y:number}[]} cellCorners
 * @param {number} n
 * @returns {import('./Point.js').Point[][]}
 */
function buildEdgePoints(cellCorners, n) {
  const sides = cellCorners.length;
  const edges = [];
  for (let i = 0; i < sides; i++) {
    const start = cellCorners[i];
    const end = cellCorners[(i + 1) % sides];
    // subdivide(start, end, n + 1) returns n + 2 points (both endpoints
    // inclusive); dropping both leaves exactly the n points strictly
    // between them - and naturally yields [] when n is 0.
    edges.push([start, ...subdivide(start, end, n + 1).slice(1, -1)]);
  }
  return edges;
}

function mod(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

/**
 * Flattens one closed leap-weave curve (a cell's corners + `n` inner nails
 * per edge, one color layer per enabled stroke) into the same flat
 * `{from, to, color}[]` shape `weaveSegmentsForCurve` already returns for
 * the app's ordinary open-triplet curves - so every renderer that knows how
 * to draw that shape (`StringArtRenderer`, `ExportRenderer`, `SceneSync`)
 * needs only a one-line branch to draw a closed weave too.
 * @param {{x:number,y:number}[]} cellCorners the cell's own corner nails, in
 *   winding order (3 for a triangle cell, 4 for a square cell, 6 for a
 *   hexagon cell)
 * @param {number} n inner nails per edge
 * @param {number} leap color 0's leap; each subsequent enabled color layer
 *   uses one less (see class doc)
 * @param {{color:string, enabled:boolean}[]} colors
 * @returns {{from: import('./Point.js').Point, to: import('./Point.js').Point, color: string, layerIndex: number}[]}
 *   `layerIndex` is included alongside the `{from, to, color}` shape
 *   `weaveSegmentsForCurve` already returns - 2D consumers can destructure
 *   just the three they know about and ignore it; the 3D page's per-layer
 *   height baking (`SceneSync#buildWeaveObject`'s closed-weave branch) needs
 *   it to know which layer a given segment belongs to.
 */
export function closedWeaveSegmentsForCurve(cellCorners, n, leap, colors) {
  const sides = cellCorners.length;
  if (sides < 3) return [];

  const edges = buildEdgePoints(cellCorners, n);
  const perEdge = n + 1;
  const total = perEdge * sides;

  const pointAt = (globalIndex) => {
    const g = mod(globalIndex, total);
    return edges[Math.floor(g / perEdge)][g % perEdge];
  };

  const result = [];
  colors.forEach((layer, layerIndex) => {
    if (!layer.enabled) return;
    const step = perEdge + (leap - layerIndex);
    for (let g = 0; g < total; g++) {
      result.push({ from: pointAt(g), to: pointAt(g + step), color: layer.color, layerIndex });
    }
  });
  return result;
}

/**
 * The physical nail positions one closed-weave curve needs beyond its own
 * corners: every interpolated inner nail along each edge - mirrors
 * `nailPositionsForCurve`'s role for the app's ordinary curves (see that
 * file's own doc). Independent of `leap`/color count, unlike the open-curve
 * version - a closed weave's inner nails are wherever `n` puts them, not
 * derived from how many colors happen to be enabled.
 * @param {{x:number,y:number}[]} cellCorners
 * @param {number} n
 * @returns {{controlPoints: {x:number,y:number}[], innerPoints: {x:number,y:number}[]}}
 */
export function closedWeaveInnerNailPositions(cellCorners, n) {
  const edges = buildEdgePoints(cellCorners, n);
  // Each edge's own corner is already a control point - only its inner
  // nails (index 1 onward) are new.
  const innerPoints = edges.flatMap((edge) => edge.slice(1));
  return { controlPoints: cellCorners, innerPoints };
}
