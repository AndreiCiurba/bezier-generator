import { Pin } from '../models/Pin.js';
import { findNearestPoint } from './nearestPoint.js';
import { deformGrid } from './deformation/puppetWarp.js';

// Sensible starting values for a freshly-created pin - roughly a few nails'
// worth of reach at the grid tool's default spacing (60px), gentle falloff.
export const DEFAULT_PIN_RADIUS = 180;
export const DEFAULT_PIN_FALLOFF = 1;

// Pin ids are purely internal bookkeeping (never exported/imported/persisted
// like Pattern ids are), so a plain local counter is enough - no need for
// utils/id.js's real (CDN-sourced) uuid, which would also drag a browser-only
// dependency into this otherwise pure, unit-tested module.
let nextPinId = 0;
function generatePinId() {
  return `pin-${nextPinId++}`;
}

/**
 * The "deformation engine" (deformable_nail_grid_epic.md's own term) - wraps
 * a base `Grid` and a set of Puppet Warp pins, and exposes the *same public
 * shape* a plain `Grid` already does (`.points`, `.findNearestPoint`), so
 * anything that currently consumes a `Grid` (PatternStamper, App.js's
 * click-handling/rendering) can consume a `DeformableGrid` instead without
 * being rewritten - it just doesn't know positions can now be deformed,
 * which is exactly the epic's own stated architectural requirement.
 *
 * With zero pins, `.points` is identical to the base grid's own points - so
 * nothing about the undeformed case changes (AC1/AC14: no regression).
 *
 * The base `Grid` itself is never mutated - deformation is purely additive
 * state layered on top, satisfying "preserve the existing equidistant grid
 * as the canonical/base grid" and "keep the base lattice intact".
 */
export class DeformableGrid {
  #grid;
  #pins = [];
  #cachedPoints = null; // invalidated (set null) on any pin mutation

  /** @param {import('./Grid.js').Grid} grid */
  constructor(grid) {
    this.#grid = grid;
  }

  /** Current (possibly deformed) nail positions - one per base nail, same order. */
  get points() {
    if (!this.#cachedPoints) {
      this.#cachedPoints = this.#pins.length === 0 ? this.#grid.points : deformGrid(this.#grid.points, this.#pins);
    }
    return this.#cachedPoints;
  }

  get pins() {
    return this.#pins;
  }

  /** Nearest *current* nail to `worldPos` - duck-types `Grid#findNearestPoint`. */
  findNearestPoint(worldPos, maxDistance = 10) {
    return findNearestPoint(this.points, worldPos, maxDistance);
  }

  /**
   * Nearest nail by its *current* (possibly deformed) position - i.e. what's
   * actually rendered where the user is clicking - but returns the
   * corresponding *base* point, since that's what a new pin's
   * `referencePosition` should anchor to (a fixed base-grid location, not
   * wherever that nail happened to be displayed at click time).
   *
   * Fixes a real bug: creating a pin used to search `Grid#findNearestPoint`
   * directly (base positions) against a click made on the *deformed* canvas.
   * Once even one pin existed, every nail within its influence radius had
   * already moved away from its base position - so Ctrl-clicking the nail
   * you could actually see would miss (nothing within range in base-space),
   * and no second pin could ever be placed near the first one's influence.
   * @param {{x:number,y:number}} worldPos
   * @param {number} [maxDistance]
   * @returns {import('./Point.js').Point | null}
   */
  findNearestBaseNail(worldPos, maxDistance = 10) {
    const current = this.points;
    let nearestIndex = -1;
    let nearestDist = Infinity;
    for (let i = 0; i < current.length; i++) {
      const d = current[i].distanceTo(worldPos);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIndex = i;
      }
    }
    if (nearestIndex === -1 || nearestDist > maxDistance) return null;
    return this.#grid.points[nearestIndex];
  }

  /** Nearest pin (by its current, draggable position) to `worldPos`, or null. */
  findNearestPin(worldPos, maxDistance = 10) {
    let nearest = null;
    let nearestDist = Infinity;
    for (const pin of this.#pins) {
      const d = pin.position.distanceTo(worldPos);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = pin;
      }
    }
    return nearestDist <= maxDistance ? nearest : null;
  }

  /**
   * Creates a new pin anchored at `referencePosition` (normally a base nail
   * the user just Ctrl-clicked), initially undragged (position ===
   * referencePosition, so it contributes zero displacement until moved).
   * @param {{referencePosition: {x:number,y:number}, radius?: number, falloff?: number}} config
   * @returns {Pin}
   */
  addPin({ referencePosition, radius = DEFAULT_PIN_RADIUS, falloff = DEFAULT_PIN_FALLOFF }) {
    const pin = new Pin({ id: generatePinId(), referencePosition, radius, falloff });
    this.#pins.push(pin);
    this.#invalidate();
    return pin;
  }

  /** Drags `pin` to `worldPos` - the deformed grid updates live from here. */
  movePin(pin, worldPos) {
    pin.position.set(worldPos.x, worldPos.y);
    this.#invalidate();
  }

  removePin(pin) {
    const index = this.#pins.indexOf(pin);
    if (index === -1) return;
    this.#pins.splice(index, 1);
    this.#invalidate();
  }

  /** Clears every pin - the grid reverts exactly to its base positions. */
  reset() {
    this.#pins = [];
    this.#invalidate();
  }

  /**
   * Forces the next `.points` read to recompute. Needed by callers (e.g.
   * `DeformationUI`, when applying a new radius/falloff to the selected pin)
   * that mutate a `Pin`'s fields directly rather than going through
   * `addPin`/`movePin`/`removePin` - those already invalidate on their own.
   */
  invalidate() {
    this.#invalidate();
  }

  #invalidate() {
    this.#cachedPoints = null;
  }
}
