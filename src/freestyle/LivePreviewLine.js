import { axisMisalignment, alignmentCloseness } from './lineAlignment.js';
import { lerpColor } from './colorGradient.js';

// Grey (far off-axis) fades continuously to yellow (getting close, the
// app's own gold accent) across the whole range. Red is *not* part of that
// fade - it's a separate, discrete "pixel-perfect" signal, so a near-miss
// still reads as yellow and only an exact hit jumps to red. That contrast
// is the point: it should be obvious at a glance whether you're merely
// close or genuinely on-axis.
const NORMAL_COLOR = [100, 100, 100]; // grey - matches CanvasView.drawGuidePath
const CLOSE_COLOR = [255, 204, 0]; // yellow - the app's gold button accent (--btn-bg)
const PERFECT_COLOR = [220, 40, 40]; // red - pixel-perfect only
// How far off-axis (screen px) still counts as "somewhat close" - the grey->
// yellow fade spans this whole range, not a hard on/off switch at some tiny
// distance (which read as an abrupt grey->color jump).
const GRADIENT_RANGE_PX = 50;
// Screen px within which an offset counts as "the perfect pixel", not just
// "very close" - small enough to require genuinely landing on the exact row/
// column, not a size that would let red bleed into the yellow fade.
const PIXEL_PERFECT_PX = 1;
const LINE_WEIGHT = 2;

/**
 * The "rubber band" segment from the most recently placed point to the
 * current cursor, shown while building a curve on freestyle - a preview of
 * the next segment before you click to commit it. Grey fades continuously
 * to yellow as it approaches perfectly horizontal or vertical; only exactly
 * on axis (within PIXEL_PERFECT_PX) does it snap to red, a deliberately
 * discrete jump so pixel-perfect alignment is unmistakable rather than just
 * the reddest end of a fade.
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

    const [r, g, b] =
      offset <= PIXEL_PERFECT_PX
        ? PERFECT_COLOR
        : lerpColor(NORMAL_COLOR, CLOSE_COLOR, alignmentCloseness(offset, GRADIENT_RANGE_PX));

    strokeWeight(LINE_WEIGHT);
    stroke(r, g, b);
    line(fromWorld.x, fromWorld.y, cursorWorld.x, cursorWorld.y);
  }
}
