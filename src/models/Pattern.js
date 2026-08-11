import { Point } from '../core/Point.js';
import { translatePointsTo } from '../core/pointTransforms.js';

/**
 * A named, reusable curve shape that can be stamped onto the grid at any nail.
 *
 * Deliberately has no dependency on ID generation (or anything else browser-
 * or CDN-specific) - callers creating a brand-new pattern pass in an `id`
 * (see PatternUI, which sources one from utils/id.js). That keeps this class
 * pure geometry + data, so its translation math can be unit tested directly.
 */
export class Pattern {
  /**
   * @param {{id: string, name: string, points: {x:number,y:number}[], colors: {color:string,enabled:boolean}[]}} config
   */
  constructor({ id, name, points, colors }) {
    this.id = id;
    this.name = name;
    this.points = points.map((p) => Point.from(p));
    this.colors = colors;
  }

  /**
   * Translated copy of this pattern's points so that `points[0]` lands on `anchor`.
   * Pure geometry - no p5, no store mutation - so it's easy to unit test.
   * @param {{x:number,y:number}} anchor
   * @returns {Point[]}
   */
  translatedTo(anchor) {
    return translatePointsTo(this.points, anchor);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      points: this.points.map((p) => ({ x: p.x, y: p.y })),
      colors: this.colors,
    };
  }
}
