/**
 * Remembering where the camera was, so a page reopened later shows the board
 * from the same place instead of jumping back to its default view. Plain
 * numbers only (no three.js import), so the saved shape is unit-testable.
 */

const isPoint = (p) => p && [p.x, p.y, p.z].every(Number.isFinite);

/**
 * The camera's position and orbit target as plain numbers, ready to save.
 * @param {{position:{x:number,y:number,z:number}}} camera
 * @param {{target:{x:number,y:number,z:number}}} controls
 */
export function cameraSnapshot(camera, controls) {
  const { x, y, z } = camera.position;
  const t = controls.target;
  return { position: { x, y, z }, target: { x: t.x, y: t.y, z: t.z } };
}

/** A saved snapshot if it is usable, otherwise null (nothing saved, or damaged). */
export function normalizeCameraSnapshot(raw) {
  if (!raw || !isPoint(raw.position) || !isPoint(raw.target)) return null;
  const { position: p, target: t } = raw;
  if (p.x === t.x && p.y === t.y && p.z === t.z) return null; // looking at itself: no direction
  return { position: { x: p.x, y: p.y, z: p.z }, target: { x: t.x, y: t.y, z: t.z } };
}

/**
 * Puts a saved view back. Returns false (and changes nothing) when there is
 * no usable snapshot, so the caller can fall back to its default view.
 */
export function restoreCamera(camera, controls, raw) {
  const snapshot = normalizeCameraSnapshot(raw);
  if (!snapshot) return false;
  const { position: p, target: t } = snapshot;
  camera.position.set(p.x, p.y, p.z);
  controls.target.set(t.x, t.y, t.z);
  camera.lookAt(t.x, t.y, t.z);
  controls.update();
  return true;
}
