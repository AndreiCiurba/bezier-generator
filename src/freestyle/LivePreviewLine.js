import { axisMisalignment, alignmentCloseness } from './lineAlignment.js';
import { lerpColor } from './colorGradient.js';

const NORMAL_COLOR = [100, 100, 100]; // grey - matches CanvasView.drawGuidePath
const ALIGNED_COLOR = [220, 40, 40]; // red - perfectly straight
// How far off-axis (screen px) still counts as "somewhat close" - the color
// fades from grey to red across this whole range, not a hard on/off switch
// at some tiny distance (which read as an abrupt grey->color jump).
const GRADIENT_RANGE_PX = 50;
const LINE_WEIGHT = 2;

/**
 * The "rubber band" segment from the most recently placed point to the
 * current cursor, shown while building a curve on freestyle - a preview of
 * the next segment before you click to commit it. Fades from grey to red as
 * it approaches perfectly horizontal or vertical - full red exactly on
 * axis, grey at/beyond GRADIENT_RANGE_PX off, continuous in between - so
 * "getting close to straight" reads as a smooth gradient rather than a
 * sudden color snap right at the threshold.
 */
export class LivePreviewLine {
  /**
   * @param {import('../core/Viewport.js').Viewport} viewport
   * @param {{x:number,y:number}} fromWorld the last placed point
   * @param {{x:number,y:number}} cursorWorld current mouse position, world space
   * @param {number} cursorScreenX @param {number} cursorScreenY current mouse position, screen space
   */
  static draw(viewport, fromWorld, cursorWorld, cursorScreenX, cursorScreenY) {
    const fromScreen = viewport.toScreen(fromWorld.x, fromWorld.y);
    const offset = axisMisalignment(fromScreen, { x: cursorScreenX, y: cursorScreenY });
    const closeness = alignmentCloseness(offset, GRADIENT_RANGE_PX);
    const [r, g, b] = lerpColor(NORMAL_COLOR, ALIGNED_COLOR, closeness);

    strokeWeight(LINE_WEIGHT);
    stroke(r, g, b);
    line(fromWorld.x, fromWorld.y, cursorWorld.x, cursorWorld.y);
  }
}
