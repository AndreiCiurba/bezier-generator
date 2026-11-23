import { ellipseNailPositions, stackChords } from '../core/cardioidWeave.js';
import { normalizeRun, runsFromLegacy, DEFAULT_RUN_GAP_MM } from './cardioidRun.js';

/**
 * A cardioid saved from the Cardioid page into the library, so the Arrange
 * board can place it like any Shape Designer shape. It keeps the weave's own
 * settings (not baked strings), so it always weaves exactly like the page.
 *
 * Each layer is a stack of runs (see `core/cardioidWeave.js`); runs sit
 * `runGapMm` apart, one thread on the other.
 *
 * Shares the parts of `FreeformShape`'s shape that Arrange reads generically
 * (`id`, `name`, `nailCount`, `leap`, `colors`, `height`, `weight`,
 * `resampledOutline()`, `toJSON()`); `kind: 'cardioid'` tells them apart (see
 * `shapeFromJSON.js`). `colors` here is one entry per run, so Arrange's color
 * swatches recolor the runs.
 */
export class CardioidShape {
  /**
   * @param {{
   *   id: string, name: string,
   *   nailCount: number, layerCount: number, leap: number, multiplier: number,
   *   radius: number, stretch?: number, direction?: 'cw'|'ccw',
   *   runs?: import('./cardioidRun.js').CardioidRun[], runGapMm?: number,
   *   colors?: {color:string, enabled:boolean}[], rangeStart?: number|null, rangeEnd?: number|null,
   *   height?: number|null, weight?: number|null,
   * }} config without `runs` (saved before runs existed), the old `colors` +
   *   `rangeStart`/`rangeEnd` become runs that weave the same; `height` null =
   *   the Arrange board's global height
   */
  constructor({
    id, name, nailCount, layerCount, leap, multiplier, radius,
    stretch = 1, direction = 'cw', runs, runGapMm = DEFAULT_RUN_GAP_MM,
    colors = [], rangeStart = null, rangeEnd = null, height = null, weight = null,
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
    this.runs = Array.isArray(runs)
      ? runs.map((r) => normalizeRun(r, nailCount))
      : runsFromLegacy({ nailCount, colors, rangeStart, rangeEnd });
    this.runGapMm = Number.isFinite(runGapMm) && runGapMm >= 0 ? runGapMm : DEFAULT_RUN_GAP_MM;
    this.height = height;
    this.weight = weight;
  }

  /** One color per run, in stack order - what Arrange's swatches show and edit. */
  get colors() {
    return this.runs.map((r) => ({ color: r.color, enabled: r.enabled }));
  }

  set colors(colors) {
    colors.forEach((c, i) => {
      if (!this.runs[i]) return;
      this.runs[i].color = c.color;
      this.runs[i].enabled = Boolean(c.enabled);
    });
  }

  /** The nails in the shape's own space, centred on the origin. Named like `FreeformShape#resampledOutline` so Arrange can size and outline either kind. */
  resampledOutline() {
    return ellipseNailPositions(this.nailCount, this.radius, { stretch: this.stretch, direction: this.direction });
  }

  /**
   * Every chord of every visible run of every layer, as nail indices into `resampledOutline()`.
   * @returns {{fromIndex:number, toIndex:number, color:string, layerIndex:number, stackIndex:number, runIndex:number, single:boolean}[]}
   */
  chords() {
    return stackChords({
      nailCount: this.nailCount, layerCount: this.layerCount, leap: this.leap, multiplier: this.multiplier, runs: this.runs,
    });
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
      runs: this.runs.map((r) => ({ ...r })),
      runGapMm: this.runGapMm,
      height: this.height,
      weight: this.weight,
    };
  }

  static fromJSON(raw) {
    return new CardioidShape({ ...raw, height: raw.height ?? null, weight: raw.weight ?? null });
  }
}
