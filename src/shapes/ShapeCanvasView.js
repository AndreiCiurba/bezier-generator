import { sampleClosedOutline } from '../core/bezierOutline.js';

/**
 * Canvas "furniture" for the Shape Designer - the vector-editor affordances
 * (anchor dots, handle markers, the smooth outline guide) that aren't
 * themselves string art, the Shape Designer's own equivalent of
 * `core/CanvasView.js` (kept separate rather than extending that shared file,
 * matching how `freestyle/GraphPaperRenderer.js` is its own independent
 * drawing helper rather than folding freestyle-only concerns into it).
 */

const ANCHOR_COLOR = '#ffcc0090';
const ANCHOR_SELECTED_COLOR = '#ffcc00';
const ANCHOR_DIAMETER = 9;
const ANCHOR_SELECTED_DIAMETER = 13;
// Unmistakably different from an anchor - a small square, the standard
// vector-editor convention for a bezier handle tip.
const HANDLE_COLOR = '#00e5ffcc';
const HANDLE_LINE_COLOR = '#00e5ff60';
const HANDLE_SIZE = 7;
// The first anchor gets a highlighted ring while the shape is still open, to
// hint "click here to close the loop" (see ShapeDesignerApp's own close-pick
// logic).
const CLOSE_HINT_COLOR = '#ffffffa0';
const OUTLINE_GUIDE_COLOR = '#888888';
// The live freehand trace, while the mouse is still down - the same gold
// accent as a selected anchor, so it reads as "actively being drawn right
// now" rather than a passive guide.
const FREEHAND_PATH_COLOR = '#ffcc00';
// Previously committed shapes drawn as faint reference while a new one is
// being worked on - no functional link between them (see docs), purely visual.
const COMMITTED_SHAPE_ALPHA = 0.3;

export class ShapeCanvasView {
  /**
   * The smooth bezier outline (a thin guide line, not the actual weave) for
   * the shape currently being edited.
   * @param {import('../core/bezierOutline.js').Anchor[]} anchors
   */
  static drawOutlineGuide(anchors) {
    const points = sampleClosedOutline(anchors);
    if (points.length < 2) return;
    noFill();
    stroke(OUTLINE_GUIDE_COLOR);
    strokeWeight(1.5);
    beginShape();
    for (const p of points) vertex(p.x, p.y);
    endShape(CLOSE);
  }

  /**
   * Every anchor as a small dot - the selected one (if any) larger/brighter.
   * While the shape isn't closed yet, the first anchor also gets a ring
   * around it, hinting that clicking there closes the loop.
   * @param {import('../core/bezierOutline.js').Anchor[]} anchors
   * @param {number|null} selectedIndex
   * @param {boolean} closed
   */
  static drawAnchors(anchors, selectedIndex, closed) {
    noStroke();
    anchors.forEach((anchor, i) => {
      const isSelected = i === selectedIndex;
      fill(isSelected ? ANCHOR_SELECTED_COLOR : ANCHOR_COLOR);
      const d = isSelected ? ANCHOR_SELECTED_DIAMETER : ANCHOR_DIAMETER;
      ellipse(anchor.x, anchor.y, d, d);
    });

    if (!closed && anchors.length >= 3) {
      const first = anchors[0];
      noFill();
      stroke(CLOSE_HINT_COLOR);
      strokeWeight(1.5);
      ellipse(first.x, first.y, ANCHOR_DIAMETER + 8, ANCHOR_DIAMETER + 8);
    }
  }

  /**
   * The selected anchor's own handles - a line from the anchor to each
   * handle tip, and a small square marker at each tip. Drawn only for the
   * currently selected anchor, matching the standard vector-editor
   * convention of only showing handles for what you're actively working on.
   * @param {import('../core/bezierOutline.js').Anchor[]} anchors
   * @param {number|null} selectedIndex
   */
  static drawSelectedHandles(anchors, selectedIndex) {
    if (selectedIndex === null) return;
    const anchor = anchors[selectedIndex];
    if (!anchor) return;

    for (const handle of [anchor.handleIn, anchor.handleOut]) {
      if (!handle) continue;
      stroke(HANDLE_LINE_COLOR);
      strokeWeight(1);
      line(anchor.x, anchor.y, handle.x, handle.y);

      noStroke();
      fill(HANDLE_COLOR);
      rectMode(CENTER);
      rect(handle.x, handle.y, HANDLE_SIZE, HANDLE_SIZE);
    }
  }

  /**
   * The in-progress freehand trace, open (not closed - the loop only closes
   * once the mouse is released, see `ShapeDesignerApp#mouseReleased`), one
   * captured point per `FREEHAND_MIN_POINT_SPACING` of cursor movement.
   * @param {{x:number,y:number}[]} points
   */
  static drawFreehandPath(points) {
    if (points.length < 2) return;
    noFill();
    stroke(FREEHAND_PATH_COLOR);
    strokeWeight(2);
    beginShape();
    for (const p of points) vertex(p.x, p.y);
    endShape();
  }

  /** Dims the drawing context for drawing already-committed shapes as faint background reference, matching App.js's own "set a raw canvas property, then reset it" convention for effects p5's push/pop don't track. */
  static withCommittedShapeAlpha(drawFn) {
    drawingContext.globalAlpha = COMMITTED_SHAPE_ALPHA;
    drawFn();
    drawingContext.globalAlpha = 1;
  }
}
