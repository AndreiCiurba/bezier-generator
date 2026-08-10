import { Point } from './Point.js';

/**
 * Pan/zoom camera for the canvas.
 *
 * Replaces the `panX`/`panY`/`zoom` variables that used to live as module-level
 * exports on main.js and get imported directly (and, in pattern.js, re-derived
 * inline) everywhere a screen-to-world conversion was needed.
 */
export class Viewport {
  constructor({ x = 0, y = 0, zoom = 1 } = {}) {
    this.x = x;
    this.y = y;
    this.zoom = zoom;
  }

  panBy(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  /** @param {number} factor e.g. 0.9 to zoom out, 1.1 to zoom in */
  zoomBy(factor) {
    this.zoom *= factor;
  }

  toWorld(screenX, screenY) {
    return new Point((screenX - this.x) / this.zoom, (screenY - this.y) / this.zoom);
  }

  toScreen(worldX, worldY) {
    return new Point(worldX * this.zoom + this.x, worldY * this.zoom + this.y);
  }

  /** Applies the current pan/zoom to the active p5 drawing context. */
  applyTransform() {
    translate(this.x, this.y);
    scale(this.zoom);
  }
}
