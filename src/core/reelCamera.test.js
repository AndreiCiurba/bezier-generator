import { describe, it, expect } from 'vitest';
import { flyPathPoint, resolveOrbitCamera, cameraShotAt, cameraCuts } from './reelCamera.js';

const path = [
  { t: 0, x: -1, y: 0, h: 0.1 },
  { t: 0.5, x: 0, y: 0, h: 0.05 },
  { t: 1, x: 1, y: 0.5, h: 0.4 },
];

describe('flyPathPoint', () => {
  it('passes exactly through every waypoint, so a recipe can thread the camera between two named nails', () => {
    for (const p of path) expect(flyPathPoint(path, p.t)).toEqual({ x: p.x, y: p.y, h: p.h });
  });

  it('never overshoots a hover and backs up to it, so a pause before a fast dive does not bounce', () => {
    const hover = [{ t: 0, x: 0, y: 0, h: 12.5 }, { t: 0.4, x: 0, y: 0, h: 11.8 }, { t: 0.5, x: 0, y: 0, h: 3.8 }];
    let previous = Infinity;
    for (let k = 0; k <= 100; k++) {
      const { h } = flyPathPoint(hover, (k / 100) * 0.5);
      expect(h).toBeLessThanOrEqual(previous + 1e-9);
      previous = h;
    }
  });

  it('turns the view smoothly past a nearby look point instead of whipping round in a few frames', () => {
    const camera = { fly: { path: [{ t: 0, x: 0, y: 0.6, h: 0.15 }, { t: 1, x: 0, y: -0.6, h: 0.15 }], look: { x: 0, y: 0, h: 0.1 }, bank: 0 } };
    const facing = (t) => {
      const p = resolveOrbitCamera(camera, t, 1);
      const v = { x: p.target.x - p.position.x, y: p.target.y - p.position.y, z: p.target.z - p.position.z };
      const l = Math.hypot(v.x, v.y, v.z);
      return { x: v.x / l, y: v.y / l, z: v.z / l };
    };
    let worst = 0;
    for (let k = 1; k <= 300; k++) {
      const a = facing((k - 1) / 300);
      const b = facing(k / 300);
      worst = Math.max(worst, Math.acos(Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z)));
    }
    // Unsmoothed, the view flips about 180 degrees within a frame or two as the camera passes over the point.
    expect((worst * 180) / Math.PI).toBeLessThan(15);
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

describe('the fly camera at the end of a clip', () => {
  it('moves smoothly through the last frames instead of juddering, because a reel loops on its last frame', () => {
    const cam = { fly: { path: [{ t: 0, x: -1, y: 0, h: 0.2 }, { t: 0.5, x: 0, y: 0.6, h: 0.2 }, { t: 1, x: 1, y: 0, h: 0.6 }], bank: 0.4 } };
    const rolls = [];
    for (let k = 900; k <= 1000; k += 2) rolls.push(resolveOrbitCamera(cam, k / 1000, 1).roll);
    const steps = rolls.slice(1).map((r, i) => r - rolls[i]);
    const jumps = steps.slice(1).map((d, i) => Math.abs(d - steps[i]));
    expect(Math.max(...jumps)).toBeLessThan(0.05);
  });

  it('levels out while it turns to watch the piece', () => {
    const path = [{ t: 0, x: -1, y: 0, h: 0.1 }, { t: 0.5, x: 0, y: 0, h: 0.1 }, { t: 1, x: 0, y: 1, h: 0.1 }];
    const watching = resolveOrbitCamera({ fly: { path, look: { x: 0, y: 0, h: 0, blend: 1 } } }, 0.5, 100);
    expect(watching.roll).toBeCloseTo(0);
  });
});

describe('the fly camera on a wall-hung piece', () => {
  const wall = (p) => ({ x: p.x, y: -p.y, z: p.h }); // mountPoint for an upright wall
  const pose = (from, to, extra = {}) => resolveOrbitCamera({ fly: { path: [{ t: 0, ...from }, { t: 1, ...to }], bank: 0, ...extra } }, 0.5, 100, wall);

  it('keeps the board below it while it dives down the wall, instead of turning the picture upside down', () => {
    // Board +y runs down the wall; flying that way along the board, up must point out of the wall.
    const { up } = pose({ x: 0, y: -0.5, h: 0.1 }, { x: 0, y: 0.5, h: 0.1 });
    expect(up.z).toBeCloseTo(1);
  });

  it('flies level across the wall, with the board as its floor rather than tipped sideways', () => {
    const { up } = pose({ x: -0.5, y: 0, h: 0.1 }, { x: 0.5, y: 0, h: 0.1 });
    expect(up.z).toBeCloseTo(1);
    expect(up.x).toBeCloseTo(0);
  });

  it("keeps the room's up when it looks straight into the wall, where the board gives no direction", () => {
    const { up } = pose({ x: 0, y: 0, h: 1 }, { x: 0, y: 0, h: 0.5 });
    expect(up.y).toBeCloseTo(1);
  });

  it("can keep the room's up with horizon 0", () => {
    const { up } = pose({ x: -0.5, y: 0, h: 0.1 }, { x: 0.5, y: 0, h: 0.1 }, { horizon: 0 });
    expect(up.y).toBeCloseTo(1);
  });

  it('gives a flat board the same up as before, since its ground is the room floor', () => {
    const flat = resolveOrbitCamera({ fly: { path: [{ t: 0, x: -1, y: 0, h: 0.1 }, { t: 1, x: 1, y: 0, h: 0.1 }], bank: 0 } }, 0.5, 100);
    expect(flat.up.y).toBeCloseTo(1);
  });
});

describe('a camera cut together from shots', () => {
  const camera = {
    fov: 40,
    shots: [
      { from: 0, azimuth: 0, elevation: 0, distance: 2 },
      { from: 0.5, fly: { path: [{ t: 0.5, x: -1, y: 0, h: 0.1 }, { t: 1, x: 1, y: 0, h: 0.1 }], bank: 0 } },
      { from: 0.8, azimuth: 180, elevation: 0, distance: 2, fov: 60 },
    ],
  };

  it('shows each shot from its own start to the next one, with the fields beside the shots as defaults', () => {
    expect(cameraShotAt(camera, 0.2)).toMatchObject({ index: 0, from: 0, to: 0.5 });
    expect(cameraShotAt(camera, 0.5)).toMatchObject({ index: 1, from: 0.5, to: 0.8 });
    expect(cameraShotAt(camera, 0.9).shot.fov).toBe(60);
    expect(resolveOrbitCamera(camera, 0.2, 1).fov).toBe(40);
    expect(cameraCuts(camera)).toEqual([0.5, 0.8]);
  });

  it('cuts cleanly from an orbit shot to a drone shot and back', () => {
    expect(resolveOrbitCamera(camera, 0.2, 1).position.x).toBeCloseTo(2);
    expect(resolveOrbitCamera(camera, 0.5, 100).position.x).toBeCloseTo(-100);
    expect(resolveOrbitCamera(camera, 0.9, 1).position.x).toBeCloseTo(-2);
  });

  it("does not let the steadicam look ahead into the next shot, so a shot's last frames face its own way", () => {
    const cut = {
      shots: [
        { from: 0, fly: { path: [{ t: 0, x: -1, y: 0, h: 0.1 }, { t: 0.5, x: 0, y: 0, h: 0.1 }], bank: 0, smooth: 0.05 } },
        { from: 0.5, fly: { path: [{ t: 0.5, x: 0, y: 0, h: 0.1 }, { t: 1, x: 0, y: 1, h: 0.1 }], bank: 0, smooth: 0.05 } },
      ],
    };
    const before = resolveOrbitCamera(cut, 0.49, 100);
    const facing = before.target.x - before.position.x;
    expect(facing).toBeGreaterThan(0.99);
    const after = resolveOrbitCamera(cut, 0.5, 100);
    expect(after.target.z - after.position.z).toBeGreaterThan(0.99);
  });
});
