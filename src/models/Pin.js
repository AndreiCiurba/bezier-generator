import { Point } from '../core/Point.js';

/**
 * A single Puppet-Warp deformation pin (see deformable_nail_grid_epic.md,
 * Feature 1). `referencePosition` is fixed at creation time (the base-grid
 * nail it was Ctrl-clicked on) - it's what influence distance is measured
 * from, so a pin's affected neighborhood stays put in base-grid space as you
 * drag it, rather than chasing the cursor. `position` is where it's been
 * dragged to; `position - referencePosition` is its displacement vector (see
 * core/deformation/puppetWarp.js).
 */
export class Pin {
  /**
   * @param {{id: string, referencePosition: {x:number,y:number}, position?: {x:number,y:number}, radius: number, falloff: number}} config
   */
  constructor({ id, referencePosition, position, radius, falloff }) {
    this.id = id;
    this.referencePosition = Point.from(referencePosition);
    this.position = Point.from(position ?? referencePosition);
    this.radius = radius;
    this.falloff = falloff;
  }
}
