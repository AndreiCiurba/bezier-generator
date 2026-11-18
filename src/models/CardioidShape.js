import { ellipseNailPositions, layerChords } from '../core/cardioidWeave.js';

/**
 * A cardioid saved from the Cardioid page into the library, so the Arrange
 * board can place it like any Shape Designer shape. It keeps the weave's own
 * settings (not baked strings), so it always weaves exactly like the page.
 *
 * Shares the parts of `FreeformShape`'s shape that Arrange reads generically
 * (`id`, `name`, `nailCount`, `leap`, `colors`, `height`, `weight`,
 * `resampledOutline()`, `toJSON()`); `kind: 'cardioid'` tells them apart (see
 * `shapeFromJSON.js`).
 */
export class CardioidShape {
  /**
   * @param {{
   *   id: string, name: string,
   *   nailCount: number, layerCount: number, leap: number, multiplier: number,
   *   radius: number, stretch?: number, direction?: 'cw'|'ccw',
   *   rangeStart?: number|null, rangeEnd?: number|null,
   *   colors: {color:string, enabled:boolean}[],
   *   height?: number|null, weight?: number|null,
   * }} config `rangeStart`/`rangeEnd` null = every thread; `height` null = the Arrange board's global height
   */
  constructor({
    id, name, nailCount, layerCount, leap, multiplier, radius,
    stretch = 1, direction = 'cw', rangeStart = null, rangeEnd = null, colors, height = null, weight = null,
  }) {
    this.kind = 'cardioid';
    this.id = id;
    this.name = name;
    this.nailCount = nailCount;
    this.layerCount = layerCount;
    this.leap = leap;
    this.multiplier = multiplier;
    this.radius = radius;
    this.stretch = Number.isFinite(stretch) && stretch > 0 ? stretch : 1;
    this.direction = direction === 'ccw' ? 'ccw' : 'cw';
    this.rangeStart = Number.isInteger(rangeStart) ? rangeStart : null;
    this.rangeEnd = Number.isInteger(rangeEnd) ? rangeEnd : null;
    this.colors = colors.map((c) => ({ color: c.color, enabled: c.enabled }));
    this.height = height;
    this.weight = weight;
  }

  /** `{start, end}` of the visible threads, or null when every thread shows. */
  get range() {
    return this.rangeStart === null || this.rangeEnd === null ? null : { start: this.rangeStart, end: this.rangeEnd };
  }

  /** The nails in the shape's own space, centred on the origin. Named like `FreeformShape#resampledOutline` so Arrange can size and outline either kind. */
  resampledOutline() {
    return ellipseNailPositions(this.nailCount, this.radius, { stretch: this.stretch, direction: this.direction });
  }

  /**
   * Every visible thread of every layer, as nail indices into `resampledOutline()`.
   * `colorIndex` indexes the enabled colors only, like the Cardioid page.
   * @returns {{fromIndex:number, toIndex:number, colorIndex:number, color:string, layerIndex:number}[]}
   */
  chords() {
    const enabled = this.colors.filter((c) => c.enabled).map((c) => c.color);
    if (enabled.length === 0) return [];
    const chords = [];
    for (let layerIndex = 0; layerIndex < this.layerCount; layerIndex++) {
      for (const chord of layerChords({
        nailCount: this.nailCount, multiplier: this.multiplier, leap: this.leap, layerIndex,
        colorCount: enabled.length, range: this.range,
      })) {
        chords.push({ ...chord, color: enabled[chord.colorIndex], layerIndex });
      }
    }
    return chords;
  }

  toJSON() {
    return {
      kind: this.kind,
      id: this.id,
      name: this.name,
      nailCount: this.nailCount,
      layerCount: this.layerCount,
      leap: this.leap,
      multiplier: this.multiplier,
      radius: this.radius,
      stretch: this.stretch,
      direction: this.direction,
      rangeStart: this.rangeStart,
      rangeEnd: this.rangeEnd,
      colors: this.colors,
      height: this.height,
      weight: this.weight,
    };
  }

  static fromJSON(raw) {
    return new CardioidShape({ ...raw, height: raw.height ?? null, weight: raw.weight ?? null });
  }
}
