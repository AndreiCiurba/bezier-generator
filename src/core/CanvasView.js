import { Point } from './Point.js';
import { StringArtRenderer } from './StringArtRenderer.js';
import { flipPoints, translatePointsTo } from './pointTransforms.js';
import { strokeWeightForColorCount } from './strokeWeight.js';

// Preview strokes are always plain white regardless of the active palette -
// it's a shape preview, not a color preview. (Kept at 7 entries, matching the
// original getPatternPreviewStrokes - the active palette has 8 slots, so the
// preview's 8th/outermost weave layer never renders. Unclear if intentional;
// left as-is since it's a cosmetic-only quirk, not a functional bug.)
const PREVIEW_STROKES = Array.from({ length: 7 }, () => ({ color: '#ffffff', enabled: true }));

// Grey, ~50% alpha - visually distinct from both the white list-hover
// preview above and from real (opaque, colored) placed curves.
const ARMED_PREVIEW_COLOR = '#c8c8c880';

// Gold accent, matching the app's own on-axis highlight color (see
// lineAlignment/colorGradient) - used for the ctrl-held control-point editor.
const CONTROL_POINT_COLOR = '#ffcc0090';
const CONTROL_POINT_ACTIVE_COLOR = '#ffcc00';
const CONTROL_POINT_DIAMETER = 7;
const CONTROL_POINT_ACTIVE_DIAMETER = 11;

/**
 * Small drawing helpers for canvas "furniture" that isn't itself string art:
 * the grid dots, the in-progress selection guide line, and pattern-shape
 * previews.
 */
export class CanvasView {
  static drawGridDots(points) {
    stroke(100);
    strokeWeight(1);
    for (const p of points) {
      ellipse(p.x, p.y, 5, 5);
    }
  }

  static drawGuidePath(points) {
    noFill();
    stroke(100);
    strokeWeight(2);
    for (let i = 0; i < points.length - 1; i++) {
      line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    }
  }

  /**
   * The preview shown while hovering a saved pattern's row in the list
   * (before it's necessarily selected) - fixed near the cursor, screen-space
   * positioned.
   * @param {import('../models/Pattern.js').Pattern} pattern
   * @param {{x:number,y:number}} mousePosition raw screen-space mouse position
   */
  static drawPatternPreview(pattern, mousePosition) {
    const origin = new Point(pattern.points[0].x - 140, pattern.points[0].y);
    const offset = Point.from(mousePosition).sub(origin);
    const translated = pattern.points.map((p) => p.add(offset));
    StringArtRenderer.drawCurve(translated, PREVIEW_STROKES);
  }

  /**
   * The ghost preview for a pattern that's armed for stamping (selected, in
   * Manual placement mode): follows the cursor exactly where the pattern
   * would land if clicked right now, greyed out, in the same shape/density
   * (segments, line weight) the real stamp would use. `flip` mirrors the
   * shape the same way the hold-V/hold-H shortcuts do (see pointTransforms.js).
   * @param {import('../models/Pattern.js').Pattern} pattern
   * @param {{x:number,y:number}} anchorWorldPos where pattern.points[0] would land
   * @param {{horizontal?: boolean, vertical?: boolean}} [flip]
   */
  static drawArmedPatternPreview(pattern, anchorWorldPos, flip) {
    const flipped = flipPoints(pattern.points, flip);
    const translated = translatePointsTo(flipped, anchorWorldPos);
    const previewStrokes = pattern.colors.map(() => ({ color: ARMED_PREVIEW_COLOR, enabled: true }));
    StringArtRenderer.drawCurve(
      translated,
      previewStrokes,
      pattern.colors.length,
      strokeWeightForColorCount(pattern.colors.length)
    );
  }

  /**
   * Every control point of every curve currently on the canvas, highlighted -
   * shown while Ctrl is held and nothing else is armed (see backlog item 8,
   * "drag & drop a pattern point"). `activePoint`, if given, is drawn larger/
   * fully opaque to mark the one point actually grabbed for dragging.
   * @param {import('../models/Curve.js').Curve[]} curves
   * @param {{curve: import('../models/Curve.js').Curve, pointIndex: number}|null} [activePoint]
   */
  static drawControlPointHighlights(curves, activePoint = null) {
    noStroke();
    for (const curve of curves) {
      for (let i = 0; i < curve.points.length; i++) {
        const isActive = activePoint && activePoint.curve === curve && activePoint.pointIndex === i;
        fill(isActive ? CONTROL_POINT_ACTIVE_COLOR : CONTROL_POINT_COLOR);
        const d = isActive ? CONTROL_POINT_ACTIVE_DIAMETER : CONTROL_POINT_DIAMETER;
        ellipse(curve.points[i].x, curve.points[i].y, d, d);
      }
    }
  }
}
