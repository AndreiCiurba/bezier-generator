import { closedWeaveSegmentsForCurve } from './closedWeaveMath.js';
import { chordDrawAmount } from './cardioidWeave.js';

/**
 * The part of a closed leap weave that is strung at a given moment of a reel,
 * as plain segments with a height at each end - the shared building block of
 * the Arrange and Grid reel scenes (`arrange/arrangeReelFrame.js`,
 * `three-page/gridReelFrame.js`). The chords themselves are exactly the app's
 * own (`closedWeaveSegmentsForCurve`); this only decides how many of them are
 * on yet, and cuts the one being strung short so it visibly travels.
 *
 * A woven segment is `{ a: {x, y, h}, b: {x, y, h}, color }` - `x`/`y` in 2D
 * design space and `h` the world height of that end (the same convention as
 * `axisMapping#to3D`).
 */

/**
 * @param {{
 *   ring: {x:number,y:number}[],   // the closed ring's corners (a shape's nails, or a grid cell's corners)
 *   inner?: number,                // nails added along each ring edge (0 for a shape, whose ring already is its nails)
 *   leap: number,
 *   rule?: 'legacy'|'center',
 *   layerColors: string[],         // one color per layer, bottom layer first
 *   progress?: number,             // 0..1, how much of the weave is strung
 *   drawMode?: 'sequential'|'parallel', // layer after layer, or every layer at once
 *   heightAt: (layerIndex:number, point:{x:number,y:number}) => number,
 * }} params
 * @returns {{a:{x:number,y:number,h:number}, b:{x:number,y:number,h:number}, color:string}[]}
 */
export function partialClosedWeave({ ring, inner = 0, leap, rule = 'center', layerColors, progress = 1, drawMode = 'sequential', heightAt }) {
  if (ring.length < 3 || layerColors.length === 0 || progress <= 0) return [];
  const layerCount = layerColors.length;
  const all = closedWeaveSegmentsForCurve(ring, inner, leap, layerColors.map((color) => ({ color, enabled: true })), rule);
  const perLayer = all.length / layerCount;
  const out = [];
  for (let layer = 0; layer < layerCount; layer++) {
    const drawn = chordDrawAmount({ layerIndex: layer, layerCount, chordsPerLayer: perLayer, progress, mode: drawMode });
    const whole = Math.floor(drawn);
    const part = drawn - whole;
    for (let k = 0; k < Math.min(perLayer, Math.ceil(drawn)); k++) {
      const { from, to, color } = all[layer * perLayer + k];
      const f = k < whole ? 1 : part;
      if (f <= 0) continue;
      const end = { x: from.x + (to.x - from.x) * f, y: from.y + (to.y - from.y) * f };
      out.push({
        a: { x: from.x, y: from.y, h: heightAt(layer, from) },
        b: { x: end.x, y: end.y, h: heightAt(layer, end) },
        color,
      });
    }
  }
  return out;
}

/**
 * Height of layer `index` of `count` within a stack running from `base` to
 * `base + span`, with an equal margin top and bottom - the same spacing as
 * `curveZLayers.js#worldColorLayerHeight`.
 */
export function stackHeight(index, count, base, span) {
  return base + ((index + 1) / (count + 1)) * span;
}

/** A deterministic 0..1 value per integer - for "random" orders that come out the same on every render. */
export function hash01(n) {
  let x = (n + 0x9e3779b9) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
