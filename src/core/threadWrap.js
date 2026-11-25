/**
 * Real-world thread scale for the Arrange board: 10 world units = 1 mm, so
 * the default 12000 x 12000 board is a 120 x 120 cm physical board.
 *
 * A string between two nails is never one line in real life - the thread goes
 * out and back, wrapping both nails, so every connection is two strands:
 * - '8' (figure-eight): the strands cross halfway between the nails, so the
 *   pair reads as one thinner line.
 * - 'O' (loop): the strands run parallel, one nail-width apart, so the pair
 *   reads as one thicker line.
 * Strand centrelines run tangent to a circle of radius
 * nail radius + thread radius around each nail, so thicker rods spread the
 * strands further apart.
 *
 * Pure and DOM/Three-free so the 3D board and the PNG export share it.
 */

export const WORLD_UNITS_PER_MM = 10;
// 40/2 spun polyester.
export const DEFAULT_THREAD_WIDTH_MM = 0.25;
export const DEFAULT_NAIL_DIAMETER_MM = 1.5;
export const WRAP_FIGURE_EIGHT = '8';
export const WRAP_LOOP = 'O';
export const DEFAULT_WRAP_TECHNIQUE = WRAP_FIGURE_EIGHT;

export const MIN_THREAD_WIDTH_MM = 0.01;
export const MAX_THREAD_WIDTH_MM = 10;
export const MIN_NAIL_DIAMETER_MM = 0.1;
export const MAX_NAIL_DIAMETER_MM = 50;

// Nails this wide or wider are plain rods: drawn without a head.
export const HEADLESS_NAIL_DIAMETER_MM = 3;

/** Whether a nail of this real diameter has a head (thinner ones do; 3 mm and up are plain rods). */
export function nailHasHead(diameterMm) {
  return diameterMm < HEADLESS_NAIL_DIAMETER_MM;
}

export function mmToWorld(mm) {
  return mm * WORLD_UNITS_PER_MM;
}

/** World units -> centimetres, for showing board sizes in real-life terms. */
export function worldToCm(units) {
  return units / WORLD_UNITS_PER_MM / 10;
}

/**
 * Reads a saved/typed thread setup, falling back to the defaults for any
 * missing or out-of-range field so a bad value never breaks the board.
 * @returns {{threadWidthMm:number, nailDiameterMm:number, technique:'8'|'O'}}
 */
export function normalizeThreadSettings(raw) {
  const inRange = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
  return {
    threadWidthMm: inRange(raw?.threadWidthMm, MIN_THREAD_WIDTH_MM, MAX_THREAD_WIDTH_MM) ? raw.threadWidthMm : DEFAULT_THREAD_WIDTH_MM,
    nailDiameterMm: inRange(raw?.nailDiameterMm, MIN_NAIL_DIAMETER_MM, MAX_NAIL_DIAMETER_MM) ? raw.nailDiameterMm : DEFAULT_NAIL_DIAMETER_MM,
    technique: raw?.technique === WRAP_LOOP ? WRAP_LOOP : WRAP_FIGURE_EIGHT,
  };
}

/**
 * The world-unit numbers one shape instance is drawn with.
 * @param {{threadWidthMm:number, nailDiameterMm:number, technique:string}} settings
 * @param {number} [nailScale] the instance's own nail thickness multiplier
 * @returns {{lineWidth:number, wrapRadius:number, nailRadius:number, technique:string}}
 */
export function threadGeometry(settings, nailScale = 1) {
  const nailRadius = mmToWorld(settings.nailDiameterMm * nailScale) / 2;
  const lineWidth = mmToWorld(settings.threadWidthMm);
  return { lineWidth, nailRadius, wrapRadius: nailRadius + lineWidth / 2, technique: settings.technique };
}

/**
 * The two strands of thread that connect nail `from` to nail `to`.
 * @param {{x:number,y:number}} from
 * @param {{x:number,y:number}} to
 * @param {number} wrapRadius distance from a nail's centre to a strand's centreline
 * @param {'8'|'O'} technique
 * @returns {[{from:{x:number,y:number}, to:{x:number,y:number}}, {from:{x:number,y:number}, to:{x:number,y:number}}]}
 */
export function wrapStrands(from, to, wrapRadius, technique) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return [{ from, to }, { from, to }];
  const ux = dx / length;
  const uy = dy / length;
  const nx = -uy;
  const ny = ux;
  const r = wrapRadius;

  if (technique === WRAP_LOOP) {
    return [
      { from: { x: from.x + nx * r, y: from.y + ny * r }, to: { x: to.x + nx * r, y: to.y + ny * r } },
      { from: { x: from.x - nx * r, y: from.y - ny * r }, to: { x: to.x - nx * r, y: to.y - ny * r } },
    ];
  }

  // Crossing tangents meet at the midpoint. When the nails nearly touch there
  // are none, so fall back to straight across.
  const c = Math.min((2 * r) / length, 1);
  const s = Math.sqrt(1 - c * c);
  const strand = (sign) => {
    const ox = r * (c * ux + sign * s * nx);
    const oy = r * (c * uy + sign * s * ny);
    return { from: { x: from.x + ox, y: from.y + oy }, to: { x: to.x - ox, y: to.y - oy } };
  };
  return [strand(1), strand(-1)];
}

/**
 * The strands actually strung for one connection: both, or - for a `single`
 * connection, where the thread ends going one way - just the first.
 */
export function connectionStrands(from, to, wrapRadius, technique, single = false) {
  const strands = wrapStrands(from, to, wrapRadius, technique);
  return single ? strands.slice(0, 1) : strands;
}

/** Every segment replaced by its strands (two, or one when `single`), keeping each segment's other fields (color, layerIndex, ...). */
export function expandToStrands(segments, wrapRadius, technique) {
  const strands = [];
  for (const segment of segments) {
    for (const { from, to } of connectionStrands(segment.from, segment.to, wrapRadius, technique, segment.single)) {
      strands.push({ ...segment, from, to });
    }
  }
  return strands;
}
