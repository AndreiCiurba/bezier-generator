import { Point } from './Point.js';
import { StringArtRenderer } from './StringArtRenderer.js';

// Preview strokes are always plain white regardless of the active palette -
// it's a shape preview, not a color preview. (Kept at 7 entries, matching the
// original getPatternPreviewStrokes - the active palette has 8 slots, so the
// preview's 8th/outermost weave layer never renders. Unclear if intentional;
// left as-is since it's a cosmetic-only quirk, not a functional bug.)
const PREVIEW_STROKES = Array.from({ length: 7 }, () => ({ color: '#ffffff', enabled: true }));

/**
 * Small drawing helpers for canvas "furniture" that isn't itself string art:
 * the grid dots, the in-progress selection guide line, and the floating
 * pattern-shape preview shown while hovering a saved pattern in the list.
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
   * @param {import('../models/Pattern.js').Pattern} pattern
   * @param {{x:number,y:number}} mousePosition raw screen-space mouse position
   */
  static drawPatternPreview(pattern, mousePosition) {
    const origin = new Point(pattern.points[0].x - 140, pattern.points[0].y);
    const offset = Point.from(mousePosition).sub(origin);
    const translated = pattern.points.map((p) => p.add(offset));
    StringArtRenderer.drawCurve(translated, PREVIEW_STROKES);
  }
}
