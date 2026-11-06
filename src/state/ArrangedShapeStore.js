/**
 * Every shape instance placed on the Arrange board: a frozen snapshot of the
 * `FreeformShape` it came from (anchors/nailCount/leap/colors/height - never
 * aliasing the imported library, same "freeze a copy at placement time" rule
 * `PatternStamper` already follows for grid patterns) plus its own on-board
 * transform (`position`/`rotationRadians`/`scale`). `onChange` notifies on
 * every mutation, matching `CurveStore`'s convention - `ArrangeSceneSync`
 * rebuilds its Three.js objects from this store exactly the way `SceneSync`
 * does from `CurveStore`.
 */
export class ArrangedShapeStore {
  #instances = [];
  #listeners = new Set();

  get instances() {
    return this.#instances;
  }

  get count() {
    return this.#instances.length;
  }

  findById(id) {
    return this.#instances.find((i) => i.id === id) ?? null;
  }

  /**
   * Places a new instance - `shapeSnapshot` must already be a frozen copy
   * (callers build it via `FreeformShape#toJSON`/`fromJSON`, never the live
   * library object) so later edits to the library never retroactively move
   * or reshape an already-placed instance.
   * @param {{id: string, shapeId: string, shapeSnapshot: import('../models/FreeformShape.js').FreeformShape, position: {x:number,y:number}, rotationRadians?: number, scale?: number}} config
   */
  add({ id, shapeId, shapeSnapshot, position, rotationRadians = 0, scale = 1 }) {
    this.#instances.push({ id, shapeId, shapeSnapshot, position, rotationRadians, scale });
    this.#notify();
  }

  remove(id) {
    const index = this.#instances.findIndex((i) => i.id === id);
    if (index === -1) return;
    this.#instances.splice(index, 1);
    this.#notify();
  }

  move(id, position) {
    const instance = this.findById(id);
    if (!instance) return;
    instance.position = position;
    this.#notify();
  }

  setRotation(id, rotationRadians) {
    const instance = this.findById(id);
    if (!instance) return;
    instance.rotationRadians = rotationRadians;
    this.#notify();
  }

  setScale(id, scale) {
    const instance = this.findById(id);
    if (!instance) return;
    instance.scale = scale;
    this.#notify();
  }

  /** Overrides just this instance's own woven height (independent of the shape library's own default) - `null` reverts it to the Arrange board's global height. */
  setHeight(id, height) {
    const instance = this.findById(id);
    if (!instance) return;
    instance.shapeSnapshot.height = height;
    this.#notify();
  }

  /** Overrides just this instance's own stroke weight (independent of the shape library's own default) - `null` reverts it to the Arrange board's global stroke weight. Same convention as `setHeight`. */
  setWeight(id, weight) {
    const instance = this.findById(id);
    if (!instance) return;
    instance.shapeSnapshot.weight = weight;
    this.#notify();
  }

  clear() {
    this.#instances.length = 0;
    this.#notify();
  }

  /**
   * Replaces the whole placed-instances list, e.g. after importing a
   * previously-exported arrangement JSON - mirrors `ShapeLibraryStore#importShapes`.
   * @param {unknown[]} rawInstances
   * @param {typeof import('../models/FreeformShape.js').FreeformShape} ShapeClass
   */
  importInstances(rawInstances, ShapeClass) {
    for (const raw of rawInstances) {
      if (raw.id && raw.shapeId && raw.shapeSnapshot && raw.position) {
        this.#instances.push({
          id: raw.id,
          shapeId: raw.shapeId,
          shapeSnapshot: ShapeClass.fromJSON(raw.shapeSnapshot),
          position: { x: raw.position.x, y: raw.position.y },
          rotationRadians: raw.rotationRadians ?? 0,
          scale: raw.scale ?? 1,
        });
      }
    }
    this.#notify();
  }

  toJSON() {
    return this.#instances.map((i) => ({
      id: i.id,
      shapeId: i.shapeId,
      shapeSnapshot: i.shapeSnapshot.toJSON(),
      position: { x: i.position.x, y: i.position.y },
      rotationRadians: i.rotationRadians,
      scale: i.scale,
    }));
  }

  /**
   * Subscribes to any add/remove/move/setRotation/setScale/setHeight/
   * setWeight/clear/importInstances change. Returns an unsubscribe function.
   * @param {() => void} listener
   * @returns {() => void}
   */
  onChange(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #notify() {
    for (const listener of this.#listeners) listener();
  }
}
