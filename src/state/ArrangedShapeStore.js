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
  add({ id, shapeId, shapeSnapshot, position, rotationRadians = 0, scale = 1, name, nailsVisible = null, nailScale = 1 }) {
    this.#instances.push({
      id, shapeId, shapeSnapshot, position, rotationRadians, scale,
      name: name || this.#nextName(shapeSnapshot.name),
      nailsVisible,
      nailScale,
    });
    this.#notify();
  }

  /**
   * `<shape name>_<n>`, n counting up from 1 per shape name. Takes one more
   * than the highest number already in use rather than counting instances, so
   * deleting `Circle_1` never makes the next one collide with a surviving
   * `Circle_2`.
   * @param {string} baseName
   */
  #nextName(baseName) {
    const prefix = `${baseName || 'Shape'}_`;
    let highest = 0;
    for (const { name } of this.#instances) {
      if (!name || !name.startsWith(prefix)) continue;
      const suffix = name.slice(prefix.length);
      if (/^[0-9]+$/.test(suffix)) highest = Math.max(highest, Number(suffix));
    }
    return `${prefix}${highest + 1}`;
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

  /** Replaces just this instance's own color layers (`{color, enabled}[]`) - the library shape it came from is never touched. */
  setColors(id, colors) {
    const instance = this.findById(id);
    if (!instance) return;
    instance.shapeSnapshot.colors = colors.map((c) => ({ color: c.color, enabled: c.enabled }));
    this.#notify();
  }

  /** Per-instance nail visibility - `true`/`false` forces it, `null` follows the Arrange board's global setting. */
  setNailsVisible(id, visible) {
    const instance = this.findById(id);
    if (!instance) return;
    instance.nailsVisible = visible;
    this.#notify();
  }

  /** Per-instance nail thickness multiplier (nail height always follows the shape's string height). */
  setNailScale(id, nailScale) {
    const instance = this.findById(id);
    if (!instance) return;
    instance.nailScale = nailScale;
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
        const shapeSnapshot = ShapeClass.fromJSON(raw.shapeSnapshot);
        this.#instances.push({
          id: raw.id,
          shapeId: raw.shapeId,
          shapeSnapshot,
          position: { x: raw.position.x, y: raw.position.y },
          rotationRadians: raw.rotationRadians ?? 0,
          scale: raw.scale ?? 1,
          // Arrangements saved before instances were named get one now.
          name: raw.name || this.#nextName(shapeSnapshot.name),
          nailsVisible: typeof raw.nailsVisible === 'boolean' ? raw.nailsVisible : null,
          nailScale: Number.isFinite(raw.nailScale) && raw.nailScale > 0 ? raw.nailScale : 1,
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
      name: i.name,
      nailsVisible: i.nailsVisible,
      nailScale: i.nailScale,
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
