import { ovalAnchors } from '../core/shapePresets.js';
import { resampleClosedOutline } from '../core/bezierOutline.js';
import { transformAnchors } from '../core/shapeTransform.js';
import { resolveTrack, resolveColor, colorGradient, colorBands, resolveOrbitCamera, windowProgress, flyPathPoint } from '../core/reelCamera.js';
import { resolveEnvironment, mountPoint } from '../core/reelLighting.js';
import { partialClosedWeave, stackHeight, hash01 } from '../core/reelWeave.js';
import { chordDrawAmount, nailSeating } from '../core/cardioidWeave.js';

/**
 * Pure "what does the Arrange board look like at clip time t" for the reel
 * pipeline (`ArrangeReel.js` draws it; tools/reel-pipeline/ captures it). An
 * arrange recipe (`"scene": "arrange"`) is a composition of woven shapes on
 * one board - the same shapes and the same leap weave the Shapes and
 * Arrange pages make, described inline so a recipe needs no saved library:
 *
 * - `weave`: `drawProgress` (number or track, 0..1 - the whole piece's
 *   build-up; each shape strings itself during its own `window` of it),
 *   `weight`, `nailsVisible`, `drawMode` (`"sequential"` layer after layer,
 *   or `"parallel"`), `layerSpacing` (world units between layers: when set,
 *   every figure starts at the board and its height is its layer count times
 *   this - shape `height` and `base` are ignored).
 * - `shapes`: a list, each with
 *   - `outline`: `{ type, ... }` in a unit-radius local space -
 *     `circle`; `oval` (`ratio` = height/width); `rect` (`ratio` = height/width,
 *     sharp corners); `polygon` (`sides`);
 *     `star` (`points`, `inner` = inner/outer radius); `heart`; `petal`
 *     (`width`, a lens pointing along +y); or `anchors` (raw Shapes-page anchors).
 *   - `size` (world units, the outline's radius), `nails`, `leap`, `rule`
 *     (`"center"` default, or `"legacy"`), and the layer colors - `colors`
 *     (one per layer) or `palette` + `layers` (a gradient through the palette).
 *   - `x`, `y`, `rotation` (degrees), `scale`, `height` (how tall the string
 *     stack is), `base` (how high above the board it starts - long nails
 *     carry it) - each a number or track.
 *   - `weight`: a multiplier on `weave.weight` for this shape's strings (e.g.
 *     0.6 for a soft, fine fill).
 *   - `border`: thicker strings run round the shape's own outline, nail to
 *     next nail, marking its edge: `{ weight, layers, color }` - `weight` a
 *     multiplier (default 2.5), `layers` which layers get one (`"bands"`
 *     default: the top layer of every run of one color; `"top"`, `"bottom"`,
 *     `"all"`, or a list of layer indices), `color` (default: that layer's
 *     own color). Each border is strung along with its layer.
 *   - `nailMode` (`"rise"` default: all nails grow together; `"hammer"`: one
 *     nail after another round the outline, each driven in) and `nailShare`
 *     (the share of the window spent on nails before strings, default 0.15) -
 *     both may also be set once on `weave`.
 *   - `window`: `[start, end]` - the slice of `weave.drawProgress` in which
 *     this shape is strung. Its nails rise during the first part of it.
 *   - `repeat`: `{ count, radius, phase, stagger, spin }` - `count` copies
 *     spaced round a circle of `radius` (degrees `phase` to start, every copy
 *     turned to face outward), each one's window shifted on by `stagger`.
 *     `radius` and `spin` (extra rotation of the whole ring) may be tracks.
 *     To break the symmetry, copy k can differ: `grow` (scale x grow^k),
 *     `radiusStep` (radius + k * step: a spiral), `turnStep` (extra degrees
 *     per copy), `layersStep` (more layers per copy - taller with
 *     `layerSpacing`), `arc` (spread over that many degrees, ends included,
 *     instead of the full circle), and `jitter: { angle, radius, scale,
 *     turn, layers }` (seeded random +-amounts, `seed` picks the scatter).
 *   - outline `blob`: `{ type: "blob", lobes, wobble, seed, ratio }`, an
 *     irregular organic outline (see `blobAnchors`).
 * - `board`: `{ size, color }` (`color` may be a color track - paint going
 *   on), or `false` for strings in the dark.
 * - `unit`: world units per camera distance unit (default: half the board).
 * - `camera`: the shared orbit camera, or with `fly` the drone camera whose
 *   path is in board coordinates (see `core/reelCamera.js`).
 * - `mount`, `lighting`, `room`: see `core/reelLighting.js`.
 *
 * Output: `{ board, nails: [{x, y, h}], segments: [{a, b, color}], weight,
 * nailsVisible, camera, environment }`, all in 2D design space + height (see
 * `core/reelWeave.js`).
 */

export const ARRANGE_REEL_DEFAULTS = { boardSize: 12000, weight: 0.35, height: 900, nails: 80, size: 2000 };
// Of a shape's window, the share spent raising its nails before strings go on.
const NAIL_RISE_SHARE = 0.15;
// How far above its final height a hammered nail stands when first set down.
const HAMMER_PROUD = 0.8;

const deg = (d) => (d * Math.PI) / 180;
const point = (x, y) => ({ x, y, handleIn: { x, y }, handleOut: { x, y } });

function polygonAnchors(sides, start = -Math.PI / 2) {
  return Array.from({ length: sides }, (_, i) => {
    const a = start + (i * 2 * Math.PI) / sides;
    return point(Math.cos(a), Math.sin(a));
  });
}

function starAnchors(points, inner) {
  return Array.from({ length: points * 2 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const r = i % 2 === 0 ? 1 : inner;
    return point(r * Math.cos(a), r * Math.sin(a));
  });
}

// Screen-up is -y on the board (seen from the default camera side), so the
// heart's point is at +y and its lobes at -y.
function heartAnchors() {
  const a = (x, y, inX, inY, outX, outY) => ({ x, y, handleIn: { x: inX, y: inY }, handleOut: { x: outX, y: outY } });
  return [
    a(0, 0.95, 0.4, 0.62, -0.4, 0.62), // the point
    a(-0.95, -0.12, -1.0, 0.25, -0.92, -0.5),
    a(-0.5, -0.78, -0.82, -0.8, -0.2, -0.78),
    a(0, -0.42, -0.04, -0.66, 0.04, -0.66), // the dip between the lobes
    a(0.5, -0.78, 0.2, -0.78, 0.82, -0.8),
    a(0.95, -0.12, 0.92, -0.5, 1.0, 0.25),
  ];
}

function petalAnchors(width) {
  return [
    point(0, -1),
    { x: width, y: 0, handleIn: { x: width, y: -0.55 }, handleOut: { x: width, y: 0.55 } },
    point(0, 1),
    { x: -width, y: 0, handleIn: { x: -width, y: 0.55 }, handleOut: { x: -width, y: -0.55 } },
  ];
}

/**
 * An irregular, organic closed outline: a circle whose radius swells and dips
 * by a few seeded waves - `lobes` (the main bumps round it, default 3),
 * `wobble` (how far the radius strays, 0..0.6, default 0.25), `seed` (a
 * different seed is a different shape; the same seed is always the same).
 * Also stretched by `ratio` (height/width, default 1).
 */
function blobAnchors({ lobes = 3, wobble = 0.25, seed = 1, ratio = 1 }) {
  const waves = [1, 2, 3].map((k) => ({
    frequency: Math.max(1, Math.round(lobes)) * k + (k > 1 ? Math.floor(hash01(seed * 31 + k) * 3) : 0),
    amplitude: wobble / (k * k * 0.6 + 0.4) * (0.6 + 0.4 * hash01(seed * 17 + k)),
    phase: hash01(seed * 13 + k * 7) * Math.PI * 2,
  }));
  const count = 72;
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    const r = Math.max(0.25, 1 + waves.reduce((sum, w) => sum + w.amplitude * Math.sin(w.frequency * a + w.phase), 0));
    return point(r * Math.cos(a), r * Math.sin(a) * ratio);
  });
}

/**
 * A shape's outline as Shapes-page anchors in unit-radius local space, centered on the origin.
 * @param {{type:string, ratio?:number, sides?:number, points?:number, inner?:number, width?:number, anchors?:object[]}} outline
 */
export function outlineAnchors(outline = { type: 'circle' }) {
  switch (outline.type) {
    case 'oval':
      return ovalAnchors({ x: 0, y: 0 }, 1, outline.ratio ?? 0.6);
    case 'rect': {
      const r = outline.ratio ?? 0.6;
      return [point(-1, -r), point(1, -r), point(1, r), point(-1, r)];
    }
    case 'polygon':
      return polygonAnchors(Math.max(3, outline.sides ?? 6));
    case 'star':
      return starAnchors(Math.max(3, outline.points ?? 5), outline.inner ?? 0.45);
    case 'heart':
      return heartAnchors();
    case 'petal':
      return petalAnchors(outline.width ?? 0.42);
    case 'blob':
      return blobAnchors(outline);
    case 'anchors':
      return outline.anchors;
    default:
      return ovalAnchors({ x: 0, y: 0 }, 1, 1);
  }
}

function layerColorsOf(shape, t) {
  if (shape.colors) return shape.colors.map((spec) => resolveColor(spec, t));
  const palette = (shape.palette ?? ['#ffffff']).map((spec) => resolveColor(spec, t));
  const count = Math.max(1, Math.round(shape.layers ?? palette.length));
  return shape.colorMode === 'bands' ? colorBands(palette, count) : colorGradient(palette, count);
}

/**
 * Every placed copy of every recipe shape: `repeat` expanded into its copies.
 * Each copy carries the `shape` it was made from as `source` (and `shape`,
 * the source itself or a per-copy variant when the ring varies its copies).
 */
function expandShapes(shapes, t) {
  const copies = [];
  for (const shape of shapes) {
    const repeat = shape.repeat;
    if (!repeat) {
      copies.push({ shape, source: shape, offsetX: 0, offsetY: 0, turn: 0, windowShift: 0 });
      continue;
    }
    const count = Math.max(1, Math.round(repeat.count ?? 6));
    const radius = resolveTrack(repeat.radius, t, 0);
    const spin = resolveTrack(repeat.spin, t, 0);
    const jitter = repeat.jitter ?? {};
    for (let k = 0; k < count; k++) {
      // Seeded per-copy randomness: the same recipe always scatters the same way.
      const rand = (salt) => hash01((repeat.seed ?? 1) * 7919 + k * 104729 + salt) * 2 - 1;
      const angle = (repeat.phase ?? -90) + spin + (repeat.arc ?? 360) * (k / (repeat.arc ? Math.max(1, count - 1) : count)) + (jitter.angle ?? 0) * rand(1);
      const r = radius + (repeat.radiusStep ?? 0) * k + (jitter.radius ?? 0) * rand(2);
      const grow = Math.pow(repeat.grow ?? 1, k) * (1 + (jitter.scale ?? 0) * rand(3));
      const extraLayers = Math.round((repeat.layersStep ?? 0) * k + (jitter.layers ?? 0) * rand(4));
      const varied = grow !== 1 || extraLayers !== 0 || repeat.turnStep || jitter.turn;
      const variant = !varied
        ? shape
        : {
            ...shape,
            scale: resolveTrack(shape.scale, t, 1) * grow,
            layers: Math.max(1, Math.round(shape.layers ?? (shape.palette ?? ['#fff']).length) + extraLayers),
            rotation: resolveTrack(shape.rotation, t, 0) + (repeat.turnStep ?? 0) * k + (jitter.turn ?? 0) * rand(5),
          };
      copies.push({
        shape: variant,
        source: shape,
        offsetX: r * Math.cos(deg(angle)),
        offsetY: r * Math.sin(deg(angle)),
        turn: angle - 90, // turns the shape's local +y axis to point outward from the ring's center
        windowShift: k * (repeat.stagger ?? 0),
      });
    }
  }
  return copies;
}

/**
 * Which of a shape's layers get a border. `"bands"` = the top layer of every
 * run of one color, wherever the color actually changes - so it works for
 * `colorMode: "bands"` and for any hand-written `colors` list alike.
 */
export function borderLayers(spec = 'bands', layerColors) {
  const count = layerColors.length;
  if (Array.isArray(spec)) return spec.filter((i) => i >= 0 && i < count);
  if (spec === 'all') return Array.from({ length: count }, (_, i) => i);
  if (spec === 'top') return [count - 1];
  if (spec === 'bottom') return [0];
  return layerColors.map((_, i) => i).filter((i) => i === count - 1 || layerColors[i] !== layerColors[i + 1]);
}

/** The outline strings of a shape's border layers, each strung round the ring as far as its own layer is. */
function borderSegments(shape, ring, layerColors, progress, drawMode, heightAt, time) {
  const spec = shape.border === true ? {} : shape.border;
  const weight = resolveTrack(spec.weight, time, 2.5);
  const out = [];
  for (const layer of borderLayers(spec.layers, layerColors)) {
    const drawn = chordDrawAmount({ layerIndex: layer, layerCount: layerColors.length, chordsPerLayer: ring.length, progress, mode: drawMode });
    const color = spec.color ? resolveColor(spec.color, time) : layerColors[layer];
    const h = heightAt(layer);
    for (let k = 0; k < Math.ceil(drawn); k++) {
      const from = ring[k];
      const to = ring[(k + 1) % ring.length];
      const f = Math.min(1, drawn - k);
      out.push({ a: { x: from.x, y: from.y, h }, b: { x: from.x + (to.x - from.x) * f, y: from.y + (to.y - from.y) * f, h }, color, weight });
    }
  }
  return out;
}

/**
 * One placed copy of a shape at clip time `time`, `local` of the way through
 * its own window: its nails (`ring` = where they stand, `top` = how tall they
 * end up) and the strings on it so far.
 */
function resolveFigure({ shape, offsetX, offsetY, turn }, local, weave, drawMode, time) {
  const scale = resolveTrack(shape.scale, time, 1) * resolveTrack(shape.size, time, ARRANGE_REEL_DEFAULTS.size);
  const anchors = transformAnchors(outlineAnchors(shape.outline), {
    position: { x: resolveTrack(shape.x, time, 0) + offsetX, y: resolveTrack(shape.y, time, 0) + offsetY },
    rotationRadians: deg(resolveTrack(shape.rotation, time, 0) + turn),
    scale,
  });
  const ring = resampleClosedOutline(anchors, Math.max(3, Math.round(resolveTrack(shape.nails, time, ARRANGE_REEL_DEFAULTS.nails))));
  // With a shared layer spacing every figure's first layer sits at the same
  // level just above the board and its layers climb at the same pitch, so a
  // 4-layer figure is a short stack and a 50-layer one a tall stack of the same threads.
  const spacing = resolveTrack(weave.layerSpacing, time, 0);
  const height = spacing > 0 ? (layerColorsOf(shape, time).length + 1) * spacing : resolveTrack(shape.height, time, ARRANGE_REEL_DEFAULTS.height);
  const base = spacing > 0 ? 0 : resolveTrack(shape.base, time, 0);
  const top = base + height;

  const nails = [];
  const segments = [];
  const nailShare = resolveTrack(shape.nailShare ?? weave.nailShare, time, NAIL_RISE_SHARE);
  const rise = nailShare > 0 ? Math.min(1, local / nailShare) : 1;
  if ((shape.nailMode ?? weave.nailMode) === 'hammer') {
    // One nail after another round the outline, each set down proud and driven in to its height.
    ring.forEach((p, k) => {
      const seat = nailSeating({ nailIndex: k, nailCount: ring.length, progress: rise });
      if (seat > 0) nails.push({ x: p.x, y: p.y, h: top * (1 + HAMMER_PROUD * (1 - seat)) });
    });
  } else {
    for (const p of ring) nails.push({ x: p.x, y: p.y, h: top * rise });
  }

  const strung = windowProgress(local, nailShare, 1);
  if (strung > 0) {
    const layerColors = layerColorsOf(shape, time);
    const heightAt = (layer) => stackHeight(layer, layerColors.length, base, height);
    const shapeWeight = resolveTrack(shape.weight, time, 1);
    for (const segment of partialClosedWeave({
      ring,
      leap: Math.round(resolveTrack(shape.leap, time, 0)),
      rule: shape.rule ?? 'center',
      layerColors,
      progress: strung,
      drawMode: shape.drawMode ?? drawMode,
      heightAt,
    })) {
      if (shapeWeight !== 1) segment.weight = shapeWeight;
      segments.push(segment);
    }
    if (shape.border) segments.push(...borderSegments(shape, ring, layerColors, strung, shape.drawMode ?? drawMode, heightAt, time));
  }
  return { ring, top, nails, segments };
}

/**
 * @param {object} recipe see the module doc
 * @param {number} t normalized clip time, clamped to [0, 1]
 */
export function resolveArrangeFrame(recipe, t) {
  const time = Math.min(1, Math.max(0, t));
  const weave = recipe.weave ?? {};
  const progress = resolveTrack(weave.drawProgress, time, 1);
  const drawMode = weave.drawMode ?? 'sequential';

  const nails = [];
  const segments = [];
  for (const copy of expandShapes(recipe.shapes ?? [], time)) {
    const [start, end] = copy.shape.window ?? [0, 1];
    const local = windowProgress(progress, start + copy.windowShift, end + copy.windowShift);
    if (local <= 0) continue;
    const figure = resolveFigure(copy, local, weave, drawMode, time);
    nails.push(...figure.nails);
    segments.push(...figure.segments);
  }

  const boardSpec = recipe.board ?? {};
  const boardSize = boardSpec === false ? ARRANGE_REEL_DEFAULTS.boardSize : boardSpec.size ?? ARRANGE_REEL_DEFAULTS.boardSize;
  const unit = recipe.unit ?? boardSize / 2;
  const environment = resolveEnvironment(recipe, time, unit);
  return {
    board: boardSpec === false ? null : { width: boardSize, depth: boardSpec.depth ?? boardSize, color: boardSpec.color ? resolveColor(boardSpec.color, time) : null },
    nails,
    segments,
    weight: resolveTrack(weave.weight, time, ARRANGE_REEL_DEFAULTS.weight),
    nailsVisible: weave.nailsVisible ?? true,
    camera: resolveOrbitCamera(recipe.camera, time, unit, (p) => mountPoint(p, environment.mount)),
    environment,
  };
}

// A string closer than this to a nail's center catches on it: the nail
// head's radius in the 3D views (`three-page/SceneSync.js` HEAD_RADIUS).
export const NAIL_CLEARANCE = 30;

/** Distance from (px, py) to segment a-b on the board, and how far along it (0..1) the closest point is. */
function toSegment(px, py, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  const f = length2 === 0 ? 0 : Math.min(1, Math.max(0, ((px - a.x) * dx + (py - a.y) * dy) / length2));
  return { distance: Math.hypot(px - (a.x + dx * f), py - (a.y + dy * f)), f };
}

/** The figure's footprint on the board: a circle round its nails, for skipping pairs that cannot touch. */
function footprint(ring) {
  const cx = ring.reduce((sum, p) => sum + p.x, 0) / ring.length;
  const cy = ring.reduce((sum, p) => sum + p.y, 0) / ring.length;
  return { cx, cy, r: Math.max(...ring.map((p) => Math.hypot(p.x - cx, p.y - cy))) };
}

/**
 * Where the piece could not be built as drawn, because a nail is a real rod:
 * a string of one figure running through another figure's nail (below that
 * nail's top, so it would catch and bend the curve), or two figures' nails
 * standing in the same spot. Strings that pass above a shorter figure's
 * nails are fine - that is how a figure nests inside another on long nails.
 *
 * Checked on the finished piece: at `t`, or by default the first moment the
 * whole weave is on (Rubik's-style turns after that are a flourish, not the
 * board). Returns `{ t, clashes, figures }`, where each clash is
 * `{ kind: 'string' | 'nails', figures: [i, j], shapes: [shapeIndex, shapeIndex], at: {x, y} }`
 * (a string clash: figure i's string through figure j's nail) - at most one
 * per pair of figures and kind - and `figures` is how many placed copies were
 * checked.
 * @param {object} recipe an arrange recipe
 * @param {{t?: number, clearance?: number}} [options]
 */
export function nailClashes(recipe, { t, clearance = NAIL_CLEARANCE } = {}) {
  const weave = recipe.weave ?? {};
  let time = t;
  if (time === undefined) {
    time = 1;
    for (let k = 0; k <= 200; k++) {
      if (resolveTrack(weave.drawProgress, k / 200, 1) >= 0.999) {
        time = k / 200;
        break;
      }
    }
  }
  const shapes = recipe.shapes ?? [];
  const copies = expandShapes(shapes, time);
  const figures = copies.map((copy) => {
    const figure = resolveFigure(copy, 1, weave, weave.drawMode ?? 'sequential', time);
    return { ...figure, shape: shapes.indexOf(copy.source), ...footprint(figure.ring) };
  });

  const clashes = [];
  for (let i = 0; i < figures.length; i++) {
    for (let j = 0; j < figures.length; j++) {
      if (i === j) continue;
      const A = figures[i];
      const B = figures[j];
      if (Math.hypot(A.cx - B.cx, A.cy - B.cy) > A.r + B.r + clearance) continue;
      const tag = { figures: [i, j], shapes: [A.shape, B.shape] };
      if (i < j) {
        const touching = A.ring.flatMap((p) => B.ring.filter((q) => Math.hypot(p.x - q.x, p.y - q.y) < clearance));
        if (touching.length) clashes.push({ kind: 'nails', ...tag, at: { x: touching[0].x, y: touching[0].y } });
      }
      const inReach = B.ring.filter((q) => Math.hypot(q.x - A.cx, q.y - A.cy) < A.r + clearance);
      hit: for (const segment of A.segments) {
        for (const nail of inReach) {
          const { distance, f } = toSegment(nail.x, nail.y, segment.a, segment.b);
          if (distance >= clearance) continue;
          const h = segment.a.h + (segment.b.h - segment.a.h) * f;
          if (h <= B.top) {
            clashes.push({ kind: 'string', ...tag, at: { x: nail.x, y: nail.y } });
            break hit;
          }
        }
      }
    }
  }
  return { t: time, clashes, figures: figures.length };
}

/**
 * The moments a `fly` camera would hit the piece: inside a nail (closer than
 * `clearance` to it, below its top) or under the board. A drone shot threads
 * between the nails and under raised strings; it must not pass through a
 * rod. Returns `[{ t, what: 'nail' | 'board', at: {x, y, h} }]`, one per
 * sampled moment, empty for an orbit camera.
 * @param {object} recipe an arrange recipe
 * @param {{samples?: number, clearance?: number}} [options]
 */
export function flyCrashes(recipe, { samples = 150, clearance = 2 * NAIL_CLEARANCE } = {}) {
  const path = recipe.camera?.fly?.path;
  if (!path?.length) return [];
  const boardSize = recipe.board === false ? ARRANGE_REEL_DEFAULTS.boardSize : recipe.board?.size ?? ARRANGE_REEL_DEFAULTS.boardSize;
  const unit = recipe.unit ?? boardSize / 2;
  const points = path.map((p) => ({ t: p.t, x: p.x ?? 0, y: p.y ?? 0, h: p.h ?? 0 })).sort((a, b) => a.t - b.t);
  const crashes = [];
  for (let k = 0; k <= samples; k++) {
    const t = k / samples;
    const p = flyPathPoint(points, t);
    const at = { x: p.x * unit, y: p.y * unit, h: p.h * unit };
    if (at.h < 0) {
      crashes.push({ t, what: 'board', at });
      continue;
    }
    const nail = resolveArrangeFrame(recipe, t).nails.find((n) => at.h < n.h && Math.hypot(n.x - at.x, n.y - at.y) < clearance);
    if (nail) crashes.push({ t, what: 'nail', at });
  }
  return crashes;
}
