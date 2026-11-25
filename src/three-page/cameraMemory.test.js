import { describe, it, expect } from 'vitest';
import { cameraSnapshot, normalizeCameraSnapshot, restoreCamera } from './cameraMemory.js';

const vector = (x, y, z) => ({ x, y, z, set(a, b, c) { this.x = a; this.y = b; this.z = c; } });

describe('cameraMemory', () => {
  it('saves and puts back the exact view, so a page reopened later looks at the board from the same place', () => {
    const camera = { position: vector(1, 2, 3), lookAt() {} };
    const controls = { target: vector(4, 5, 6), update() {} };
    const saved = JSON.parse(JSON.stringify(cameraSnapshot(camera, controls)));

    const fresh = { position: vector(0, 0, 0), lookAt() {} };
    const freshControls = { target: vector(0, 0, 0), update() {} };
    expect(restoreCamera(fresh, freshControls, saved)).toBe(true);
    expect([fresh.position.x, fresh.position.y, fresh.position.z]).toEqual([1, 2, 3]);
    expect([freshControls.target.x, freshControls.target.y, freshControls.target.z]).toEqual([4, 5, 6]);
  });

  it('ignores nothing-saved or damaged views, so the page falls back to its default view instead of breaking', () => {
    expect(normalizeCameraSnapshot(null)).toBeNull();
    expect(normalizeCameraSnapshot({ position: { x: 1, y: 'a', z: 0 }, target: { x: 0, y: 0, z: 0 } })).toBeNull();
    expect(normalizeCameraSnapshot({ position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 } })).toBeNull();
    const camera = { position: vector(9, 9, 9), lookAt() {} };
    expect(restoreCamera(camera, { target: vector(0, 0, 0), update() {} }, undefined)).toBe(false);
    expect(camera.position.x).toBe(9);
  });
});
