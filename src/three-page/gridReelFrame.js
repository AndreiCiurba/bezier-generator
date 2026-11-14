import { Grid } from '../core/Grid.js';
import { enumerateCells, sidesForGridLayout } from '../core/cellDetection.js';
import { smoothFalloff } from '../core/deformation/puppetWarp.js';
import { resolveTrack, resolveColor, colorGradient, colorBands, colorAt, resolveOrbitCamera, windowProgress } from '../core/reelCamera.js';
import { resolveEnvironment } from '../core/reelLighting.js';
import { partialClosedWeave, stackHeight, hash01 } from '../core/reelWeave.js';

/**
 * Pure "what does the /3d nail grid look like at clip time t" for the reel
 * pipeline (`GridReel.js` draws it). A grid recipe (`"scene": "grid"`) is the
 * /3d page's own lattice - the same `Grid` layouts and the same per-cell
 * Weave (`closedWeaveMath.js`) - with every cell woven, and the things a
 * physical board cannot do animated on top:
 *
 * - `grid`: `{ size, shape: "triangle"|"square"|"hexagon", spacing }`.
 * - `weave`: `inner` (nails along each cell edge), `leap`, `rule`
 *   (`"center"` default), `palette` + `layers`, `colorMode`, `weight`,
 *   `drawMode`, `nailsVisible`, and three build-up tracks:
 *   - `drawProgress` (0..1): how much of the board is strung. Cells string
 *     themselves one after another in `order` - `"center"` (out from the
 *     middle), `"sweep"` (across, at `sweepAngle` degrees), `"spiral"` or
 *     `"random"` - each over `softness` of the whole (larger overlaps more).
 *   - `nailProgress` (0..1): how many lattice nails have risen out of the
 *     board, from the center out. Default 1 (all standing).
 *   `colorMode`: `"layers"` (every cell the same gradient up its stack),
 *   `"bands"` (every cell the same, in solid bands of the palette colors),
 *   `"radial"` (a gradient across the board by distance from the center),
 *   `"angle"` (round the center, a color wheel) or `"random"`.
 * - `variety` (optional) makes every cell its own, for a board that is not
 *   one repeated tile: `{ fill, leap, layers, height, seed }` - `fill` (0..1)
 *   is the share of cells woven at all (the rest stay empty, and nails no
 *   woven cell uses stay in the board); `leap` and `layers` are how far a
 *   cell's leap may rise above, and its layer count fall below, the
 *   `weave` values (whole numbers); `height` (0..1) how much lower than the
 *   height field a cell's stack may sit. Each cell's share is a fixed
 *   pseudo-random draw from `seed`, so a recipe renders the same every time.
 * - `height`: the string stack's height across the board, so the weave is a
 *   surface, not a slab - `{ base, amplitude, wavelength, phase, shape }`,
 *   numbers or tracks; `shape` is `"flat"`, `"ripple"` (rings out from the
 *   center; animate `phase` - in cycles - to make them travel), `"wave"`
 *   (straight crests across) or `"dome"`. Lengths are in grid spacings.
 * - `warp`: Puppet-Warp-style pulls, `[{ x, y, radius, dx, dy, falloff }]`
 *   in grid spacings from the board's center; `dx`/`dy` may be tracks.
 * - `twist`: `{ angle, radius }` - a whirlpool: nails near the center turn
 *   by `angle` degrees (a track), fading to none at `radius` spacings.
 * - `board`: `{ color, padding }`, or `false` to hide it.
 * - `camera`: the shared orbit camera (`core/reelCamera.js`), in units of
 *   half the lattice's width.
 */

export const GRID_REEL_DEFAULTS = { size: 13, shape: 'triangle', spacing: 600, inner: 3, leap: 0, layers: 4, weight: 0.35, base: 600 };

// Same lattices as ThreeApp's own buildGridConfig.
function gridConfig(size, shape, spacing) {
  const rowHeight = (spacing * Math.sqrt(3)) / 2;
  if (shape === 'square') return { layout: 'square', rows: size, cols: size, spacing, rowHeight: spacing };
  if (shape === 'hexagon') return { layout: 'hexagon', rows: size, cols: size, spacing, rowHeight };
  return { layout: 'rotated', rows: size, cols: size, spacing, rowHeight };
}

const centroid = (pts) => ({ x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length });

/** Ranks 0..1 (evenly spaced, so the build-up keeps a steady pace) by ascending key. */
function rankBy(keys) {
  const order = keys.map((key, i) => [key, i]).sort((a, b) => a[0] - b[0]);
  const ranks = new Array(keys.length);
  order.forEach(([, i], position) => (ranks[i] = keys.length === 1 ? 0 : position / (keys.length - 1)));
  return ranks;
}

/**
 * The lattice and its cells - everything about a grid recipe that does not
 * change over the clip. Computed once per clip (cell detection is the
 * expensive part), then passed to every `resolveGridFrame` call.
 * @param {object} recipe
 */
export function prepareGrid(recipe) {
  const spec = recipe.grid ?? {};
  const spacing = spec.spacing ?? GRID_REEL_DEFAULTS.spacing;
  const grid = new Grid(gridConfig(spec.size ?? GRID_REEL_DEFAULTS.size, spec.shape ?? GRID_REEL_DEFAULTS.shape, spacing));
  const raw = grid.points;
  const xs = raw.map((p) => p.x);
  const ys = raw.map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const base = raw.map((p) => ({ x: p.x - cx, y: p.y - cy }));
  const indexOf = new Map(raw.map((p, i) => [p, i]));
  const cells = enumerateCells(raw, sidesForGridLayout(grid.layout))
    .map((cell) => cell.map((p) => indexOf.get(p)))
    .filter((cell) => cell.every((i) => i !== undefined));

  const width = Math.max(...xs) - Math.min(...xs);
  const depth = Math.max(...ys) - Math.min(...ys);
  const maxDistance = Math.max(...base.map((p) => Math.hypot(p.x, p.y)), 1);
  const cellCenters = cells.map((cell) => centroid(cell.map((i) => base[i])));

  const weave = recipe.weave ?? {};
  const sweep = ((weave.sweepAngle ?? 0) * Math.PI) / 180;
  const orderKey = {
    center: (c) => Math.hypot(c.x, c.y),
    sweep: (c) => c.x * Math.cos(sweep) + c.y * Math.sin(sweep),
    spiral: (c) => (Math.hypot(c.x, c.y) / maxDistance) * 3 + (Math.atan2(c.y, c.x) + Math.PI) / (2 * Math.PI),
    random: (c, i) => hash01(i),
  }[weave.order ?? 'center'] ?? ((c) => Math.hypot(c.x, c.y));

  return {
    spacing,
    base,
    cells,
    width,
    depth,
    maxDistance,
    cellCenters,
    cellRank: rankBy(cellCenters.map((c, i) => orderKey(c, i))),
    distanceRank: rankBy(cellCenters.map((c) => Math.hypot(c.x, c.y))),
    nailRank: rankBy(base.map((p) => Math.hypot(p.x, p.y))),
  };
}

function heightField(spec = {}, t, spacing, maxDistance) {
  const base = resolveTrack(spec.base, t, GRID_REEL_DEFAULTS.base);
  const amplitude = resolveTrack(spec.amplitude, t, 0);
  const wavelength = resolveTrack(spec.wavelength, t, 4) * spacing;
  const phase = resolveTrack(spec.phase, t, 0);
  const shape = spec.shape ?? 'flat';
  const wave = (s) => 0.5 * (1 + Math.sin(2 * Math.PI * (s / wavelength - phase)));
  return (p) => {
    if (shape === 'ripple') return base + amplitude * wave(Math.hypot(p.x, p.y));
    if (shape === 'wave') return base + amplitude * wave(p.x);
    if (shape === 'dome') return base + amplitude * Math.max(0, 1 - (Math.hypot(p.x, p.y) / maxDistance) ** 2);
    return base;
  };
}

/** Moves every base nail by the recipe's warp pins and twist, at time `t`. */
function deformNails(base, recipe, t, spacing) {
  const pins = (recipe.warp ?? []).map((pin) => ({
    x: (pin.x ?? 0) * spacing,
    y: (pin.y ?? 0) * spacing,
    radius: (pin.radius ?? 3) * spacing,
    falloff: pin.falloff ?? 1,
    dx: resolveTrack(pin.dx, t, 0) * spacing,
    dy: resolveTrack(pin.dy, t, 0) * spacing,
  }));
  const twistAngle = recipe.twist ? (resolveTrack(recipe.twist.angle, t, 0) * Math.PI) / 180 : 0;
  const twistRadius = (recipe.twist?.radius ?? 6) * spacing;

  return base.map((p) => {
    let x = p.x;
    let y = p.y;
    for (const pin of pins) {
      const w = smoothFalloff(Math.hypot(p.x - pin.x, p.y - pin.y), pin.radius, pin.falloff);
      x += pin.dx * w;
      y += pin.dy * w;
    }
    if (twistAngle) {
      const d = Math.hypot(x, y);
      const a = twistAngle * smoothFalloff(d, twistRadius, 1);
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      [x, y] = [x * cos - y * sin, x * sin + y * cos];
    }
    return { x, y };
  });
}

/**
 * @param {object} recipe see the module doc
 * @param {number} t normalized clip time, clamped to [0, 1]
 * @param {ReturnType<typeof prepareGrid>} prepared
 */
export function resolveGridFrame(recipe, t, prepared) {
  const time = Math.min(1, Math.max(0, t));
  const weave = recipe.weave ?? {};
  const { spacing, base, cells, cellRank, distanceRank, nailRank, cellCenters, maxDistance } = prepared;

  const nailsNow = deformNails(base, recipe, time, spacing);
  const heightAtPoint = heightField(recipe.height, time, spacing, maxDistance);

  const softness = Math.min(1, Math.max(0.001, weave.softness ?? 0.2));
  const rise = (progress, rank) => windowProgress(progress, rank * (1 - softness), rank * (1 - softness) + softness);

  const palette = (weave.palette ?? ['#ffffff']).map((spec) => resolveColor(spec, time));
  const layerCount = Math.max(1, Math.round(resolveTrack(weave.layers, time, GRID_REEL_DEFAULTS.layers)));
  const leap = Math.round(resolveTrack(weave.leap, time, GRID_REEL_DEFAULTS.leap));
  const inner = Math.max(0, Math.round(resolveTrack(weave.inner, time, GRID_REEL_DEFAULTS.inner)));

  // Each cell's own draw of the `variety` ranges.
  const variety = recipe.variety ?? null;
  const seed = (variety?.seed ?? 0) * 7919;
  const draw = (i, salt) => hash01(seed + i * 13 + salt);
  const cellSpec = cells.map((_, i) => {
    if (!variety) return { woven: true, leap, layers: layerCount, heightScale: 1 };
    return {
      woven: draw(i, 1) < (variety.fill ?? 1),
      leap: leap + Math.floor(draw(i, 2) * ((variety.leap ?? 0) + 1)),
      layers: Math.max(1, layerCount - Math.floor(draw(i, 3) * ((variety.layers ?? 0) + 1))),
      heightScale: 1 - (variety.height ?? 0) * draw(i, 4),
    };
  });

  // A nail stands as tall as the tallest woven cell it belongs to; with
  // `variety.fill`, nails no woven cell uses stay in the board.
  const nailScale = new Array(nailsNow.length).fill(variety ? 0 : 1);
  if (variety) {
    cells.forEach((cell, i) => {
      if (!cellSpec[i].woven) return;
      for (const n of cell) nailScale[n] = Math.max(nailScale[n], cellSpec[i].heightScale);
    });
  }
  const nailProgress = resolveTrack(weave.nailProgress, time, 1);
  const nails = nailsNow.map((p, i) => ({ x: p.x, y: p.y, h: heightAtPoint(p) * nailScale[i] * rise(nailProgress, nailRank[i]) }));

  const colorMode = weave.colorMode ?? 'layers';
  const spread = weave.colorSpread ?? 0.2; // how far up the palette a cell's layers range, in the board-wide modes
  const wheel = [...palette, palette[0]];
  const cellColors = (i, count) => {
    if (colorMode === 'layers') return colorGradient(palette, count);
    if (colorMode === 'bands') return colorBands(palette, count);
    const c = cellCenters[i];
    const f = { radial: distanceRank[i], angle: (Math.atan2(c.y, c.x) + Math.PI) / (2 * Math.PI), random: hash01(i + 7) }[colorMode] ?? 0;
    const colors = colorMode === 'angle' ? wheel : palette;
    return Array.from({ length: count }, (_, layer) => colorAt(colors, f + (count === 1 ? 0 : (layer / (count - 1) - 0.5) * spread)));
  };

  const drawProgress = resolveTrack(weave.drawProgress, time, 1);
  const segments = [];
  cells.forEach((cell, i) => {
    const spec = cellSpec[i];
    if (!spec.woven) return;
    const progress = rise(drawProgress, cellRank[i]);
    if (progress <= 0) return;
    segments.push(
      ...partialClosedWeave({
        ring: cell.map((n) => nailsNow[n]),
        inner,
        leap: spec.leap,
        rule: weave.rule ?? 'center',
        layerColors: cellColors(i, spec.layers),
        progress,
        drawMode: weave.drawMode ?? 'sequential',
        heightAt: (layer, p) => stackHeight(layer, spec.layers, 0, heightAtPoint(p) * spec.heightScale),
      })
    );
  });

  const boardSpec = recipe.board ?? {};
  const padding = (boardSpec.padding ?? 0.8) * spacing;
  return {
    board: boardSpec === false ? null : { width: prepared.width + 2 * padding, depth: prepared.depth + 2 * padding, color: boardSpec.color ?? null },
    nails,
    segments,
    weight: resolveTrack(weave.weight, time, GRID_REEL_DEFAULTS.weight),
    nailsVisible: weave.nailsVisible ?? true,
    camera: resolveOrbitCamera(recipe.camera, time, Math.max(prepared.width, prepared.depth) / 2),
    environment: resolveEnvironment(recipe, time, Math.max(prepared.width, prepared.depth) / 2),
  };
}
