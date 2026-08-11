/**
 * Nearest-neighbor search among a flat list of points - pure, no p5. Extracted
 * from `Grid#findNearestPoint` so `DeformableGrid` can run the exact same
 * search against *current* (possibly deformed) nail positions without
 * duplicating the loop. `Grid` itself now just delegates here.
 * @param {{x:number,y:number, distanceTo: (p:{x:number,y:number}) => number}[]} points
 * @param {{x:number,y:number}} target
 * @param {number} [maxDistance]
 * @returns {typeof points[number] | null}
 */
export function findNearestPoint(points, target, maxDistance = 10) {
  let nearest = null;
  let nearestDist = Infinity;
  for (const p of points) {
    const d = p.distanceTo(target);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = p;
    }
  }
  return nearestDist <= maxDistance ? nearest : null;
}
