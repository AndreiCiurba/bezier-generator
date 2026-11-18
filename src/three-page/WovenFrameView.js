import * as THREE from 'three';
import { to3D } from './axisMapping.js';
import { assembleWeaveLineObject } from './weaveLineBuilder.js';
import { DEFAULT_BOARD_THICKNESS, DEFAULT_BOARD_COLOR, BOARD_TOP_Y, DEFAULT_NAIL_COLOR, SHAFT_RADIUS, HEAD_RADIUS, HEAD_THICKNESS_RATIO, buildNailParts } from './SceneSync.js';
import { mountNormal, mountPoint, uprightOf, hexToRgb, shadeStrand, wallShade, projectOntoMount } from '../core/reelLighting.js';

const _color = new THREE.Color();
// Room surfaces are shaded per vertex on the CPU with the same light math as
// the strings, so the wall, the strings and their shadows always agree.
const SURFACE_DIVISIONS = 48;
// Shadows sit a hair in front of the wall/board, as a fraction of the room width.
const SHADOW_LIFT = 0.0008;
// Shadow strings are drawn in this many height bands, crisp near the surface and soft far from it.
const SHADOW_BUCKETS = 4;
// How dark the closest shadow strings are drawn (overlaps darken further).
const SHADOW_OPACITY = 0.6;
// The wall sits just behind a backing board's back face, so the two never fight for the same depth.
const WALL_Z = -(DEFAULT_BOARD_THICKNESS + 2);
// Making-of tools at `making.scale` 1, in world units (nails about 1 cm = 200 units apart).
const HAMMER_HANDLE = 3200;
const HAMMER_SWING_DEGREES = 22;
const SPOOL_RADIUS = 170;
const SPOOL_LENGTH = 480;

/** Handle along local +X from the grip (the origin), head across its far end with the striking face down. */
function buildHammer(materials) {
  const group = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1, 16), materials.wood);
  handle.rotation.z = Math.PI / 2;
  handle.position.x = 0.5;
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.36, 24), materials.steel);
  head.position.set(1, 0, 0);
  const claw = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.14, 16), materials.steel);
  claw.position.set(1, 0.24, 0);
  group.add(handle, head, claw);
  return group;
}

/** A spool along local +X: thread wound in the middle, a wooden flange each end. */
function buildSpool(materials) {
  const group = new THREE.Group();
  const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.8, 28), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 }));
  thread.rotation.z = Math.PI / 2;
  group.add(thread);
  for (const side of [-1, 1]) {
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.1, 28), materials.wood);
    flange.rotation.z = Math.PI / 2;
    flange.position.x = side * 0.45;
    group.add(flange);
  }
  group.userData.thread = thread;
  return group;
}

/**
 * Draws one resolved reel frame of the Arrange or Grid scene (see
 * `arrange/arrangeReelFrame.js`, `three-page/gridReelFrame.js`): a board, a
 * nail per `{x, y, h}` (standing `h` tall - none at `h` 0), and every woven
 * segment as one fat-line object built by the app's own
 * `weaveLineBuilder#assembleWeaveLineObject`. Rebuilt from scratch every
 * frame, like `CardioidSceneSync#rebuild`.
 *
 * With `frame.environment` (`core/reelLighting.js`) it can also hang the
 * piece on a wall, light every string, draw a room (wall + floor) and cast
 * the strings' shadows on the wall.
 */
export class WovenFrameView {
  /** @param {import('three').Scene} scene */
  constructor(scene, { nailColor = DEFAULT_NAIL_COLOR, nailThickness = 1, boardColor = DEFAULT_BOARD_COLOR } = {}) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    // Board and nails live in design space; for a wall mount this group is turned upright.
    this.mounted = new THREE.Group();
    this.group.add(this.mounted);
    this.nailParts = buildNailParts(SHAFT_RADIUS, HEAD_RADIUS);
    this.nailMaterial = new THREE.MeshStandardMaterial({ color: nailColor, metalness: 0.35, roughness: 0.45 });
    this.nailThickness = nailThickness;
    this.boardMaterial = new THREE.MeshStandardMaterial({ color: boardColor, roughness: 0.9 });
    this.boardMesh = null;
    this.boardKey = '';
    this.nailMeshes = null;
    this.lines = [];
    this.surfaces = [];
    this.resolution = new THREE.Vector2(1, 1);
    this.toolMaterials = {
      wood: new THREE.MeshStandardMaterial({ color: '#b98a52', roughness: 0.7 }),
      steel: new THREE.MeshStandardMaterial({ color: '#b9bec6', roughness: 0.35, metalness: 0.6 }),
    };
    this.hammers = [];
    this.spools = [];
  }

  setViewportSize(width, height) {
    this.resolution.set(width, height);
  }

  /**
   * @param {{board:{width:number,depth:number,color:string|null}|null, nails:{x:number,y:number,h:number}[], segments:{a:object,b:object,color:string}[], weight:number, nailsVisible:boolean, camera:object, environment?:object}} frame
   * @param {number} widthScale line width multiplier (frame width / 1080)
   */
  render(frame, widthScale = 1) {
    const env = frame.environment ?? { mount: 'board', lighting: null, room: null };
    this.mounted.rotation.x = (uprightOf(env.mount) * Math.PI) / 2;
    if (env.lighting?.background) this.scene.background = new THREE.Color(env.lighting.background);
    this.#syncBoard(frame.board);
    this.#syncNails(frame.nailsVisible ? frame.nails : []);
    this.#syncMaking(frame.making);
    this.#clearLines();
    this.#syncRoom(env);
    // No shadows while a piece is being lifted onto the wall: it is between surfaces.
    const settled = typeof env.mount !== 'number' || env.mount >= 0.999;
    if (env.lighting && env.room && settled) this.#addShadows(frame, env, widthScale);
    this.#addStrings(frame, env, widthScale);
  }

  #syncBoard(board) {
    if (!board) {
      if (this.boardMesh) this.boardMesh.visible = false;
      return;
    }
    const key = `${board.width}x${board.depth}`;
    if (key !== this.boardKey) {
      if (this.boardMesh) {
        this.mounted.remove(this.boardMesh);
        this.boardMesh.geometry.dispose();
      }
      this.boardMesh = new THREE.Mesh(new THREE.BoxGeometry(board.width, DEFAULT_BOARD_THICKNESS, board.depth), this.boardMaterial);
      this.boardMesh.position.set(0, BOARD_TOP_Y - DEFAULT_BOARD_THICKNESS / 2, 0);
      this.mounted.add(this.boardMesh);
      this.boardKey = key;
    }
    if (board.color) this.boardMaterial.color.set(board.color);
    this.boardMesh.visible = true;
  }

  #syncNails(nails) {
    const standing = nails.filter((n) => n.h > 1e-3);
    if (!this.nailMeshes || this.nailMeshes.shaft.instanceMatrix.count < standing.length) {
      if (this.nailMeshes) {
        for (const mesh of Object.values(this.nailMeshes)) {
          this.mounted.remove(mesh);
          mesh.dispose();
        }
      }
      const capacity = Math.max(16, Math.ceil(standing.length * 1.25));
      this.nailMeshes = {
        shaft: new THREE.InstancedMesh(this.nailParts.shaft, this.nailMaterial, capacity),
        head: new THREE.InstancedMesh(this.nailParts.head, this.nailMaterial, capacity),
      };
      this.mounted.add(this.nailMeshes.shaft, this.nailMeshes.head);
    }
    // The head is a thin disc of fixed thickness capping the nail, however tall the nail is.
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();
    standing.forEach((nail, i) => {
      const width = this.nailThickness * (nail.w ?? 1);
      const thick = Math.min(HEAD_RADIUS * width * HEAD_THICKNESS_RATIO, nail.h * 0.5);
      const world = to3D(nail, 0);
      position.set(world.x, world.y, world.z);
      scale.set(width, nail.h - thick, width);
      matrix.compose(position, quaternion, scale);
      this.nailMeshes.shaft.setMatrixAt(i, matrix);
      position.set(world.x, world.y + nail.h - thick / 2, world.z);
      scale.set(width, thick, width);
      matrix.compose(position, quaternion, scale);
      this.nailMeshes.head.setMatrixAt(i, matrix);
    });
    for (const mesh of Object.values(this.nailMeshes)) {
      mesh.count = standing.length;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** The making-of tools (`arrangeReelFrame.js` `making`): a hammer on each nail going in, a spool laying each string going on. */
  #syncMaking(making) {
    const hammers = making?.hammers ?? [];
    const spools = making?.spools ?? [];
    const scale = making?.scale ?? 1;
    while (this.hammers.length < hammers.length) {
      const hammer = buildHammer(this.toolMaterials);
      this.mounted.add(hammer);
      this.hammers.push(hammer);
    }
    while (this.spools.length < spools.length) {
      const spool = buildSpool(this.toolMaterials);
      this.mounted.add(spool);
      this.spools.push(spool);
    }
    const handle = HAMMER_HANDLE * scale;
    this.hammers.forEach((mesh, i) => {
      const h = hammers[i];
      mesh.visible = Boolean(h);
      if (!h) return;
      const outX = Math.cos(h.angle);
      const outZ = Math.sin(h.angle);
      mesh.scale.setScalar(handle);
      // The head's striking face rests on the nail's head; the grip is a handle's length outside.
      mesh.position.set(h.x + outX * handle, h.top + 0.18 * handle, h.y + outZ * handle);
      // Yaw turns the handle to point in at the nail; the Z turn lifts the head about the grip.
      mesh.rotation.set(0, Math.atan2(outZ, -outX), (h.raise * HAMMER_SWING_DEGREES * Math.PI) / 180, 'YXZ');
    });
    this.spools.forEach((mesh, i) => {
      const s = spools[i];
      mesh.visible = Boolean(s);
      if (!s) return;
      const radius = SPOOL_RADIUS * scale;
      mesh.scale.set(SPOOL_LENGTH * scale, radius, radius);
      // Riding just above the string's end, its axle across the string, the thread paying out from underneath.
      mesh.position.set(s.x, s.h + radius * 1.05, s.y);
      mesh.rotation.set(0, -s.angle + Math.PI / 2, 0);
      mesh.userData.thread.material.color.set(s.color);
    });
  }

  #clearLines() {
    for (const line of this.lines) {
      this.group.remove(line);
      line.geometry.dispose();
      line.material.dispose();
    }
    this.lines = [];
  }

  #pushLines(positions, colors, weight) {
    const line = assembleWeaveLineObject(positions, colors, weight, this.resolution);
    if (!line) return;
    // A string thinner than a pixel either hits a pixel or misses it, which
    // shimmers as grain. Draw it one pixel wide and as see-through as the
    // share of the pixel it covers - what antialiasing would give.
    const width = line.material.linewidth;
    if (width < 1) {
      line.material.linewidth = 1;
      line.material.transparent = true;
      line.material.opacity = Math.max(0.08, width);
      line.material.depthWrite = false;
    }
    this.group.add(line);
    this.lines.push(line);
  }

  // Line width is per object, so strings are grouped by their own weight multiplier.
  #addStrings({ segments, weight, camera }, env, widthScale) {
    const groups = new Map();
    for (const segment of segments) {
      const w = segment.weight ?? 1;
      if (!groups.has(w)) groups.set(w, []);
      groups.get(w).push(segment);
    }
    for (const [w, group] of groups) this.#addStringGroup(group, camera, env, weight * w * widthScale);
  }

  #addStringGroup(segments, camera, env, lineWeight) {
    if (segments.length === 0) return;
    const positions = new Float32Array(segments.length * 6);
    const colors = new Float32Array(segments.length * 6);
    const normal = mountNormal(env.mount);
    const cache = new Map();
    segments.forEach(({ a, b, color }, i) => {
      const o = i * 6;
      const wa = mountPoint(a, env.mount);
      const wb = mountPoint(b, env.mount);
      positions.set([wa.x, wa.y, wa.z, wb.x, wb.y, wb.z], o);
      let rgb = cache.get(color);
      if (!rgb) cache.set(color, (rgb = hexToRgb(color)));
      if (env.lighting) rgb = shadeStrand(rgb, wa, wb, env.lighting, camera.position, normal);
      _color.setRGB(rgb.r, rgb.g, rgb.b, THREE.SRGBColorSpace);
      colors[o] = colors[o + 3] = _color.r;
      colors[o + 1] = colors[o + 4] = _color.g;
      colors[o + 2] = colors[o + 5] = _color.b;
    });
    // assembleWeaveLineObject takes a stroke weight and applies the app's own weight-to-pixels scale.
    this.#pushLines(positions, colors, lineWeight);
  }

  /** Each shadow-casting light throws every string onto the wall, in the wall's own color without that light. */
  #addShadows(frame, env, widthScale) {
    const { segments, weight } = frame;
    const normal = mountNormal(env.mount);
    // Shadows fall on the board when there is one, otherwise on the wall itself
    // (which stands a little behind the board's plane), or the floor under a flat piece.
    const surface = frame.board ? frame.board.color ?? DEFAULT_BOARD_COLOR : env.mount === 'board' ? env.room.floor ?? env.room.wall : env.room.wall;
    const plane = frame.board || env.mount === 'board' ? 0 : WALL_Z;
    const wall = hexToRgb(surface);
    const lift = SHADOW_LIFT * env.room.width;
    const shift = (p, d) => ({ x: p.x + normal.x * d, y: p.y + normal.y * d, z: p.z + normal.z * d });
    const height = (p) => p.x * normal.x + p.y * normal.y + p.z * normal.z - plane;
    let maxHeight = 1e-6;
    for (const { a, b } of segments) maxHeight = Math.max(maxHeight, height(mountPoint(a, env.mount)), height(mountPoint(b, env.mount)));
    for (const light of env.lighting.lights) {
      if (!light.shadow || light.intensity <= 0) continue;
      // Project onto the receiving plane: move it to the origin, project, move back.
      const lightThere = light.type === 'point' ? { ...light, position: shift(light.position, -plane) } : light;
      // A thread's shadow softens and fades the further the thread is from the
      // surface (a real light is not a point), so strings are bucketed by height:
      // close ones throw crisp, dark shadows, high ones wide, faint ones.
      const buckets = Array.from({ length: SHADOW_BUCKETS }, () => ({ positions: [], colors: [] }));
      for (const { a, b } of segments) {
        const wa = mountPoint(a, env.mount);
        const wb = mountPoint(b, env.mount);
        const pa = projectOntoMount(shift(wa, -plane), lightThere, env.mount);
        const pb = projectOntoMount(shift(wb, -plane), lightThere, env.mount);
        if (!pa || !pb) continue;
        const f = Math.min(1, Math.max(0, (height(wa) + height(wb)) / 2 / maxHeight));
        const bucket = buckets[Math.min(SHADOW_BUCKETS - 1, Math.floor(f * SHADOW_BUCKETS))];
        const ma = shift(pa, plane + lift);
        const mb = shift(pb, plane + lift);
        const shade = wallShade(wall, { x: (ma.x + mb.x) / 2, y: (ma.y + mb.y) / 2, z: (ma.z + mb.z) / 2 }, normal, env.lighting, light);
        _color.setRGB(shade.r, shade.g, shade.b, THREE.SRGBColorSpace);
        for (const p of [ma, mb]) {
          bucket.positions.push(p.x, p.y, p.z);
          bucket.colors.push(_color.r, _color.g, _color.b);
        }
      }
      buckets.forEach((bucket, i) => {
        if (!bucket.positions.length) return;
        const f = (i + 0.5) / SHADOW_BUCKETS;
        this.#pushShadowLines(bucket, weight * widthScale * (1.2 + 2.8 * f), SHADOW_OPACITY * (1 - 0.65 * f));
      });
    }
  }

  /**
   * Shadow strings: see-through so overlapping ones darken where threads are
   * dense, as real shadows do, and drawn before the strings and never over
   * them (the figure always stands in front of its own shadow).
   */
  #pushShadowLines({ positions, colors }, width, opacity) {
    const line = assembleWeaveLineObject(new Float32Array(positions), new Float32Array(colors), width, this.resolution);
    if (!line) return;
    const pixels = line.material.linewidth;
    line.material.linewidth = Math.max(1, pixels);
    line.material.transparent = true;
    line.material.opacity = opacity * Math.min(1, Math.max(0.15, pixels));
    line.material.depthWrite = false;
    line.renderOrder = -1;
    this.group.add(line);
    this.lines.push(line);
  }

  /** The visible light: a dark spot can on a thin rod (from the ceiling, or up from the floor for an uplight), aimed at its target, its lens glowing in the light's color. */
  #addFixture(light, room) {
    if (light.type !== 'point' || !light.fixture) return;
    const size = room.width * 0.012;
    const at = light.position;
    const aim = new THREE.Vector3(light.target.x - at.x, light.target.y - at.y, light.target.z - at.z).normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), aim);
    const can = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.75, size, size * 2.6, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#1d1d22', side: THREE.DoubleSide }));
    can.quaternion.copy(quaternion);
    can.position.set(at.x, at.y, at.z);
    const glow = Math.min(1, 0.25 + 0.75 * Math.min(1, light.intensity));
    const c = light.color;
    const lens = new THREE.Mesh(new THREE.CircleGeometry(size * 0.95, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(Math.min(1, 0.15 + c.r * glow), Math.min(1, 0.15 + c.g * glow), Math.min(1, 0.15 + c.b * glow), THREE.SRGBColorSpace) }));
    lens.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), aim));
    lens.position.set(at.x + aim.x * size * 1.31, at.y + aim.y * size * 1.31, at.z + aim.z * size * 1.31);
    // Hung from the ceiling when it shines down, stood on the floor when it shines up.
    const end = at.y >= light.target.y ? room.floorY + room.height : room.floorY;
    const parts = [can, lens];
    if (Math.abs(end - at.y) > size) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.08, size * 0.08, Math.abs(end - at.y), 8), new THREE.MeshBasicMaterial({ color: '#2a2a30' }));
      rod.position.set(at.x, (end + at.y) / 2, at.z);
      parts.push(rod);
    }
    for (const mesh of parts) {
      this.group.add(mesh);
      this.surfaces.push(mesh);
    }
  }

  #syncRoom(env) {
    for (const mesh of this.surfaces) {
      this.group.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.surfaces = [];
    const { room, lighting } = env;
    if (!room) return;
    const top = room.floorY + room.height;
    if (env.mount !== 'board') {
      // The wall the piece hangs on (z = 0, facing +z) and the floor in front of it.
      // While a piece lies flat (a making-of), the wall stands back so the board fits in front of it.
      const back = (1 - uprightOf(env.mount)) * room.width * 0.5;
      this.#addSurface(room.wall, { x: 0, y: (room.floorY + top) / 2, z: WALL_Z - back }, { x: room.width, y: 0, z: 0 }, { x: 0, y: room.height, z: 0 }, { x: 0, y: 0, z: 1 }, lighting, room.brightness);
      if (room.floor) this.#addSurface(room.floor, { x: 0, y: room.floorY, z: room.width / 2 }, { x: room.width, y: 0, z: 0 }, { x: 0, y: 0, z: -room.width }, { x: 0, y: 1, z: 0 }, lighting, room.brightness);
      if (room.brightness > 0.01) for (const lamp of room.lamps ?? []) this.#addLamp(lamp, lighting);
      for (const light of lighting?.lights ?? []) this.#addFixture(light, room);
    } else {
      // A board lying flat: the "room" is a floor under it and a wall behind it.
      this.#addSurface(room.floor ?? room.wall, { x: 0, y: -(DEFAULT_BOARD_THICKNESS + 2), z: 0 }, { x: room.width, y: 0, z: 0 }, { x: 0, y: 0, z: -room.width }, { x: 0, y: 1, z: 0 }, lighting, room.brightness);
    }
  }

  /** A side table with a table lamp on it; the shade glows with the lamp's own light. */
  #addLamp(lamp, lighting) {
    const { x, z, standY, height, table } = lamp;
    if (table) {
      const top = 0.06 * table.depth;
      this.#addShadedMesh(new THREE.BoxGeometry(table.width, top, table.depth), { x, y: standY - top / 2, z }, table.color, lighting);
      const legHeight = standY - top - lamp.floorY;
      const leg = Math.max(top * 0.8, table.width * 0.03);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const at = { x: x + sx * (table.width / 2 - leg), y: lamp.floorY + legHeight / 2, z: z + sz * (table.depth / 2 - leg) };
          this.#addShadedMesh(new THREE.BoxGeometry(leg, legHeight, leg), at, table.color, lighting);
        }
      }
    }
    const base = height * 0.22;
    this.#addShadedMesh(new THREE.CylinderGeometry(base * 0.7, base, height * 0.05, 32), { x, y: standY + height * 0.025, z }, '#2b2724', lighting);
    this.#addShadedMesh(new THREE.CylinderGeometry(height * 0.018, height * 0.018, height * 0.62, 12), { x, y: standY + height * 0.31, z }, '#2b2724', lighting);
    const shadeHeight = height * 0.4;
    const geometry = new THREE.CylinderGeometry(height * 0.2, height * 0.32, shadeHeight, 48, 1, true);
    const glow = Math.min(1, lamp.light.intensity / 1.2);
    this.#addShadedMesh(geometry, { x, y: standY + height * 0.6 + shadeHeight / 2 - height * 0.02, z }, lamp.shade, lighting, (shade) => {
      const c = lamp.light.color;
      // A lit shade is the bulb's color seen through fabric: near-white in the middle of its tone.
      return { r: shade.r * (1 - glow) + Math.min(1, c.r * 1.05) * glow, g: shade.g * (1 - glow) + Math.min(1, c.g * 1.0) * glow, b: shade.b * (1 - glow) + Math.min(1, c.b * 0.95) * glow };
    }, lamp.light);
  }

  /** A mesh moved to `at`, its vertices shaded by the scene's lights (skipping `skip`, e.g. the bulb inside a shade). */
  #addShadedMesh(geometry, at, color, lighting, adjust = (c) => c, skip = null) {
    geometry.translate(at.x, at.y, at.z);
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const base = hexToRgb(color);
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      const p = { x: position.getX(i), y: position.getY(i), z: position.getZ(i) };
      const n = { x: normal.getX(i), y: normal.getY(i), z: normal.getZ(i) };
      const shade = adjust(lighting ? wallShade(base, p, n, lighting, skip) : base);
      _color.setRGB(shade.r, shade.g, shade.b, THREE.SRGBColorSpace);
      colors.set([_color.r, _color.g, _color.b], i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    this.group.add(mesh);
    this.surfaces.push(mesh);
  }

  /** A flat rectangle centered on `center`, spanned by `u` and `v`, shaded per vertex (or unlit flat color without lighting). */
  #addSurface(color, center, u, v, normal, lighting, brightness = 1) {
    const n = SURFACE_DIVISIONS;
    const base = hexToRgb(color);
    const positions = new Float32Array((n + 1) * (n + 1) * 3);
    const colors = new Float32Array((n + 1) * (n + 1) * 3);
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        const fu = i / n - 0.5;
        const fv = j / n - 0.5;
        const p = { x: center.x + u.x * fu + v.x * fv, y: center.y + u.y * fu + v.y * fv, z: center.z + u.z * fu + v.z * fv };
        const k = (j * (n + 1) + i) * 3;
        positions.set([p.x, p.y, p.z], k);
        const lit = lighting ? wallShade(base, p, normal, lighting) : base;
        const shade = { r: lit.r * brightness, g: lit.g * brightness, b: lit.b * brightness };
        _color.setRGB(shade.r, shade.g, shade.b, THREE.SRGBColorSpace);
        colors.set([_color.r, _color.g, _color.b], k);
      }
    }
    const index = [];
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const a = j * (n + 1) + i;
        index.push(a, a + 1, a + n + 1, a + 1, a + n + 2, a + n + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(index);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    this.group.add(mesh);
    this.surfaces.push(mesh);
  }
}
