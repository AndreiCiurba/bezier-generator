import { describe, it, expect } from 'vitest';
import { flyPathPoint, resolveOrbitCamera } from './reelCamera.js';

const path = [
  { t: 0, x: -1, y: 0, h: 0.1 },
  { t: 0.5, x: 0, y: 0, h: 0.05 },
  { t: 1, x: 1, y: 0.5, h: 0.4 },
];

describe('flyPathPoint', () => {
  it('passes exactly through every waypoint, so a recipe can thread the camera between two named nails', () => {
    for (const p of path) expect(flyPathPoint(path, p.t)).toEqual({ x: p.x, y: p.y, h: p.h });
  });

  it('holds at the ends instead of flying off past the last waypoint', () => {
    expect(flyPathPoint(path, 1.2)).toEqual({ x: 1, y: 0.5, h: 0.4 });
  });
});

describe('the fly camera', () => {
  it('looks where it is going, like a drone, rather than at a fixed center', () => {
    const pose = resolveOrbitCamera({ fly: { path: [{ t: 0, x: -1, y: 0, h: 0.1 }, { t: 1, x: 1, y: 0, h: 0.1 }], bank: 0 } }, 0.5, 100);
    expect(pose.position.x).toBeCloseTo(0);
    expect(pose.position.y).toBeCloseTo(10); // h is height off the board: world up for a flat board
    expect(pose.target.x).toBeGreaterThan(pose.position.x);
    expect(pose.target.y).toBeCloseTo(pose.position.y);
    expect(pose.roll).toBeCloseTo(0);
  });

  it('banks into a turn and flies level on a straight', () => {
    const turning = resolveOrbitCamera({ fly: { path: [{ t: 0, x: -1, y: 0, h: 0.1 }, { t: 0.5, x: 0, y: 0, h: 0.1 }, { t: 1, x: 0, y: 1, h: 0.1 }] } }, 0.5, 100);
    expect(Math.abs(turning.roll)).toBeGreaterThan(2);
  });

  it('can keep turned to one board point while it flies past', () => {
    const pose = resolveOrbitCamera({ fly: { path: [{ t: 0, x: -1, y: 1, h: 0.2 }, { t: 1, x: 1, y: 1, h: 0.2 }], look: { x: 0, y: 0, h: 0 } } }, 0.3, 100);
    const facing = { x: pose.target.x - pose.position.x, y: pose.target.y - pose.position.y, z: pose.target.z - pose.position.z };
    const toPoint = { x: -pose.position.x, y: -pose.position.y, z: -pose.position.z };
    const cos = (facing.x * toPoint.x + facing.y * toPoint.y + facing.z * toPoint.z) / (Math.hypot(facing.x, facing.y, facing.z) * Math.hypot(toPoint.x, toPoint.y, toPoint.z));
    expect(cos).toBeCloseTo(1);
  });

  it('maps the path through the mount, so the same board waypoints work on a wall-hung piece', () => {
    const wall = (p) => ({ x: p.x, y: -p.y, z: p.h });
    const pose = resolveOrbitCamera({ fly: { path: [{ t: 0, x: 0, y: -1, h: 0.3 }] } }, 0, 100, wall);
    expect(pose.position).toEqual({ x: 0, y: 100, z: 30 });
  });
});

describe('the fly camera turning back to the piece', () => {
  it('eases from facing ahead to facing the piece with look.blend, so a drone shot can end on a still of the whole piece', () => {
    const cam = (blend) => ({ fly: { path: [{ t: 0, x: 0, y: 2, h: 0.5 }, { t: 1, x: 0, y: 3, h: 0.5 }], look: { x: 0, y: 0, h: 0, blend }, bank: 0 } });
    const ahead = resolveOrbitCamera(cam(0), 0.5, 1);
    const back = resolveOrbitCamera(cam(1), 0.5, 1);
    expect(ahead.target.z).toBeGreaterThan(ahead.position.z); // flying away along +y (world z)
    expect(back.target.z).toBeLessThan(back.position.z); // turned round toward the center
  });
});
