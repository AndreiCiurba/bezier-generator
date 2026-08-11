import { Point } from '../Point.js';

/**
 * Pure Puppet-Warp-style deformation math - no p5, no state, so it's directly
 * unit-testable. Deforms a base nail lattice according to a set of "pins"
 * (see models/Pin.js): each pin has a fixed `referencePosition` (where it was
 * created, in base-grid space) and a `position` (where it's been dragged to).
 * A base point near a pin's *reference* position moves by that pin's
 * displacement vector, smoothly fading out with distance - a "rubbery" pull
 * that weakens the farther a point sits from the pin, reaching zero at the
 * radius edge. Overlapping pins blend by summing their individual pulls,
 * capped so the combined effect never exceeds "one full pin's worth" -
 * see `deformPoint` for why this isn't a plain normalized average.
 */

/**
 * Smooth falloff from 1 (at the pin) to 0 (at/beyond `radius`), continuous
 * and flat-tangent at both ends (smoothstep) - guarantees no abrupt jumps
 * between neighboring nails, regardless of `falloff`. Higher `falloff`
 * sharpens the cutoff near the edge of the radius; 1 is plain smoothstep.
 * @param {number} distance
 * @param {number} radius
 * @param {number} [falloff]
 * @returns {number} 0..1
 */
export function smoothFalloff(distance, radius, falloff = 1) {
  if (radius <= 0) return 0;
  const t = Math.max(0, Math.min(1, 1 - distance / radius));
  const smoothstep = t * t * (3 - 2 * t);
  return smoothstep ** falloff;
}

/**
 * The displacement one pin currently contributes, before any falloff/blend
 * weighting is applied.
 * @param {import('../../models/Pin.js').Pin} pin
 * @returns {{dx: number, dy: number}}
 */
function pinDisplacement(pin) {
  return { dx: pin.position.x - pin.referencePosition.x, dy: pin.position.y - pin.referencePosition.y };
}

/**
 * Deforms one base point according to every pin's weighted contribution.
 * Pins whose radius doesn't reach this point contribute nothing; if no pin
 * reaches it at all, the point is returned unchanged (a copy, not a
 * mutation-inviting alias of the original).
 *
 * Each pin's raw weight (0..1, from `smoothFalloff`) is applied as *that
 * fraction of its own displacement* - not averaged against the other pins.
 * With a single pin this is what actually produces the "rubbery" falloff: a
 * point at weight 0.5 moves exactly half as far as the pin was dragged, a
 * point at weight 0.1 moves a tenth as far, and so on down to zero at the
 * radius edge. (An earlier version divided by the *sum* of weights - a plain
 * weighted average - which for a single pin always cancels back out to 1.0
 * regardless of distance, i.e. every point in range snapped to the pin's
 * full displacement. That was the bug: no falloff ever reached the render.)
 *
 * The only place weights get normalized is when *multiple* pins overlap and
 * their combined weight exceeds 1 - `totalWeight / max(1, totalWeight)`
 * caps the combined pull at "one full pin's worth" without ever discounting
 * a single, non-overlapping pin's own falloff.
 * @param {Point} basePoint
 * @param {import('../../models/Pin.js').Pin[]} pins
 * @returns {Point}
 */
export function deformPoint(basePoint, pins) {
  const contributions = [];
  let totalWeight = 0;

  for (const pin of pins) {
    const weight = smoothFalloff(basePoint.distanceTo(pin.referencePosition), pin.radius, pin.falloff);
    if (weight <= 0) continue;
    contributions.push({ pin, weight });
    totalWeight += weight;
  }

  if (contributions.length === 0) return basePoint.copy();

  const normalizer = Math.max(1, totalWeight);
  let dx = 0;
  let dy = 0;
  for (const { pin, weight } of contributions) {
    const displacement = pinDisplacement(pin);
    const effectiveWeight = weight / normalizer;
    dx += displacement.dx * effectiveWeight;
    dy += displacement.dy * effectiveWeight;
  }

  return new Point(basePoint.x + dx, basePoint.y + dy);
}

/**
 * Deforms an entire base lattice - one `deformPoint` call per point, same
 * order/length as `basePoints`, so index-based nail identity is preserved.
 * @param {Point[]} basePoints
 * @param {import('../../models/Pin.js').Pin[]} pins
 * @returns {Point[]}
 */
export function deformGrid(basePoints, pins) {
  return basePoints.map((p) => deformPoint(p, pins));
}
