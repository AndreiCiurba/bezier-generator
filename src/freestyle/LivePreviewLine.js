import { isAxisAligned } from './lineAlignment.js';

const NORMAL_SHADE = 100; // matches CanvasView.drawGuidePath's grey
const ALIGNED_COLOR = [255, 204, 0]; // the app's gold button accent (--btn-bg)
const ALIGNMENT_TOLERANCE_PX = 4; // screen pixels, regardless of zoom
const LINE_WEIGHT = 2;

/**
 * The "rubber band" segment from the most recently placed point to the
 * current cursor, shown while building a curve on freestyle - a preview of
 * the next segment before you click to commit it. Turns the app's gold
 * accent color when it's (within a few screen pixels, at any zoom level)
 * perfectly horizontal or vertical, signaling "this is a straight line" -
 * the same directions the graph-paper backdrop's own lines run.
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
    const aligned = isAxisAligned(
      fromScreen,
      { x: cursorScreenX, y: cursorScreenY },
      ALIGNMENT_TOLERANCE_PX
    );

    strokeWeight(LINE_WEIGHT);
    if (aligned) {
      stroke(...ALIGNED_COLOR);
    } else {
      stroke(NORMAL_SHADE);
    }
    line(fromWorld.x, fromWorld.y, cursorWorld.x, cursorWorld.y);
  }
}
