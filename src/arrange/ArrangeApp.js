import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ShapeLibraryStore } from '../state/ShapeLibraryStore.js';
import { ArrangedShapeStore } from '../state/ArrangedShapeStore.js';
import { FreeformShape } from '../models/FreeformShape.js';
import { anchorsCentroid } from '../core/shapeTransform.js';
import { ArrangeSceneSync } from './ArrangeSceneSync.js';
import { MenuUI } from '../ui/MenuUI.js';
import { NailHeightUI } from '../three-page/NailHeightUI.js';
import { DEFAULT_NAIL_HEIGHT } from '../three-page/nailHeight.js';
import { StrokeWeightUI } from '../ui/StrokeWeightUI.js';
import { BASELINE_STROKE_WEIGHT } from '../core/strokeWeight.js';
import { OrientationGizmo } from '../three-page/OrientationGizmo.js';
import { defaultCameraPosition } from '../three-page/cameraFraming.js';
import { fromWorld3 } from '../three-page/axisMapping.js';
import { downloadJson, readJsonFile } from '../io/JsonFile.js';
import { generateId } from '../utils/id.js';

// Scaled 10x (was 1200) for the same reason as the Shapes page's own
// PRESET_RADIUS (see ShapeDesignerApp.js) - real room for a thin
// (0.01-floor) string to read as thin. Safe to take the full 10x here too:
// it's a `THREE.BoxGeometry` size, not a 2D canvas backing-buffer dimension,
// so there's no memory-blowup risk the way a literal 10x would have on the
// Grid page - `defaultCameraPosition` below re-frames to fit automatically.
const BOARD_SIZE = 12000;
const CAMERA_FOV = 50;
const CAMERA_NEAR = 1;
const CAMERA_FAR = 100000;
const ORBIT_TARGET = { x: 0, y: 0, z: 0 };
// An instance too small to have any own-radius worth clicking precisely
// (e.g. a brand-new, un-scaled tiny shape) still needs a minimum pick
// tolerance - same reasoning as the 2D pages' own NEAREST_NAIL_RADIUS, scaled
// 10x alongside BOARD_SIZE.
const MIN_INSTANCE_PICK_RADIUS = 200;

/**
 * The Arrange board page, wired together: a flat Three.js board (no nail
 * grid - see `ArrangeSceneSync`'s own doc) onto which previously-designed
 * `FreeformShape`s (imported from the Shape Designer page's exported
 * library JSON) get placed as independent, fully-woven instances, each with
 * its own position/rotation/scale and an optional height override on top of
 * this board's own global default.
 *
 * Structurally parallel to `ThreeApp.js` (scene/camera/renderer/controls/
 * resize/animate foundation, `OrientationGizmo`), but with no
 * `Grid`/`DeformableGrid` at all, and a single "Placement Mode" toggle
 * instead of `ThreeApp`'s locked top-down Drawing Mode - the simple
 * "disable OrbitControls while placing/dragging, same as the grid page's own
 * proven Drawing Mode pattern" solution to the same underlying conflict
 * (left-drag can't mean both "orbit the camera" and "place/drag a shape" at
 * once).
 */
export class ArrangeApp {
  constructor() {
    this.canvas = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
    this.gizmo = null;
    this.arrangeSceneSync = null;

    this.library = new ShapeLibraryStore(); // shapes imported from the Shape Designer, available to place
    this.instances = new ArrangedShapeStore(); // shapes actually placed on this board

    this.globalHeight = DEFAULT_NAIL_HEIGHT;
    this.globalWeight = BASELINE_STROKE_WEIGHT;
    this.armedShapeId = null; // library shape id selected for the next placement click
    this.selectedInstanceId = null; // placed instance id currently shown in the edit panel
    this.dragState = null; // { id } while a placed instance is being dragged
    this.isPlacementMode = false;

    this._raycaster = new THREE.Raycaster();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._hitPoint = new THREE.Vector3();
  }

  init() {
    this.canvas = document.getElementById('arrange-canvas');
    this.#createScene();
    this.arrangeSceneSync = new ArrangeSceneSync(this.scene, BOARD_SIZE);
    this.#createCamera();
    this.#createRenderer();
    this.#createControls();
    this.#createLighting();
    this.gizmo = new OrientationGizmo();

    new MenuUI(document.getElementById('burger'), document.getElementById('ui'), document.getElementById('closeUiBtn')).init();

    this.#initPlacementModeToggle();
    this.#initLibraryImportExport();
    this.#initGlobalHeight();
    this.#initGlobalWeight();
    this.#initArrangementExportImport();
    this.#initInstanceEditPanel();
    this.#initCameraReset();

    this.library.onChange(() => this.#renderLibraryList());
    this.instances.onChange(() => {
      this.#renderInstanceList();
      this.#syncScene();
    });
    this.#renderLibraryList();
    this.#renderInstanceList();
    this.#syncScene();

    window.addEventListener('resize', this.#handleResize);
    this.#handleResize();
    this.#animate();
  }

  #initPlacementModeToggle() {
    document.getElementById('placementModeToggle').addEventListener('change', (event) => {
      this.isPlacementMode = event.target.checked;
      this.controls.enabled = !this.isPlacementMode;
      if (this.isPlacementMode) {
        this.canvas.addEventListener('pointerdown', this.#handlePointerDown);
        this.canvas.addEventListener('pointermove', this.#handlePointerMove);
        window.addEventListener('pointerup', this.#handlePointerUp);
      } else {
        this.canvas.removeEventListener('pointerdown', this.#handlePointerDown);
        this.canvas.removeEventListener('pointermove', this.#handlePointerMove);
        window.removeEventListener('pointerup', this.#handlePointerUp);
        this.dragState = null;
      }
    });
  }

  #initLibraryImportExport() {
    const importBtn = document.getElementById('importShapesBtn');
    const importInput = document.getElementById('importShapesInput');
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = await readJsonFile(file);
        if (Array.isArray(data)) this.library.importShapes(data, FreeformShape);
      } catch (err) {
        alert('Invalid shape library file.');
        console.error(err);
      }
      importInput.value = '';
    });
  }

  #renderLibraryList() {
    const list = document.getElementById('shapeLibraryList');
    list.innerHTML = '';

    for (const shape of this.library.shapes) {
      const li = document.createElement('li');
      li.style.cursor = 'pointer';
      li.style.marginBottom = '4px';
      li.textContent = `${shape.name} (nails=${shape.nailCount}, leap=${shape.leap})`;
      li.style.border = shape.id === this.armedShapeId ? '1px solid #ffcc00' : '1px solid transparent';
      li.addEventListener('click', () => {
        this.armedShapeId = this.armedShapeId === shape.id ? null : shape.id;
        this.#renderLibraryList();
      });
      list.appendChild(li);
    }

    if (this.library.count === 0) {
      const li = document.createElement('li');
      li.textContent = 'Import a shape library to place shapes.';
      li.style.color = 'var(--panel-text-muted, #888)';
      list.appendChild(li);
    }
  }

  #initGlobalHeight() {
    new NailHeightUI(
      { input: document.getElementById('globalHeightInput'), applyBtn: document.getElementById('applyGlobalHeightBtn') },
      this.globalHeight,
      (height) => {
        this.globalHeight = height;
        this.#syncScene();
      }
    ).init();
  }

  #initGlobalWeight() {
    new StrokeWeightUI(
      { input: document.getElementById('globalWeightInput'), applyBtn: document.getElementById('applyGlobalWeightBtn') },
      this.globalWeight,
      (weight) => {
        this.globalWeight = weight;
        this.#syncScene();
      }
    ).init();
  }

  #initArrangementExportImport() {
    document.getElementById('exportArrangementBtn').addEventListener('click', () => {
      downloadJson(this.instances.toJSON(), 'arrangement.json', 2);
    });

    const importBtn = document.getElementById('importArrangementBtn');
    const importInput = document.getElementById('importArrangementInput');
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = await readJsonFile(file);
        if (Array.isArray(data)) this.instances.importInstances(data, FreeformShape);
      } catch (err) {
        alert('Invalid arrangement file.');
        console.error(err);
      }
      importInput.value = '';
    });
  }

  #initInstanceEditPanel() {
    const rotationInput = document.getElementById('instanceRotationInput');
    const scaleInput = document.getElementById('instanceScaleInput');
    const heightInput = document.getElementById('instanceHeightInput');
    const useGlobalHeightCheckbox = document.getElementById('instanceUseGlobalHeightCheckbox');
    const weightInput = document.getElementById('instanceWeightInput');
    const useGlobalWeightCheckbox = document.getElementById('instanceUseGlobalWeightCheckbox');
    const deleteBtn = document.getElementById('deleteInstanceBtn');

    rotationInput.addEventListener('change', () => {
      if (!this.selectedInstanceId) return;
      const degrees = parseFloat(rotationInput.value) || 0;
      this.instances.setRotation(this.selectedInstanceId, (degrees * Math.PI) / 180);
    });
    scaleInput.addEventListener('change', () => {
      if (!this.selectedInstanceId) return;
      const scale = parseFloat(scaleInput.value);
      if (Number.isFinite(scale) && scale > 0) this.instances.setScale(this.selectedInstanceId, scale);
    });
    useGlobalHeightCheckbox.addEventListener('change', () => {
      if (!this.selectedInstanceId) return;
      heightInput.disabled = useGlobalHeightCheckbox.checked;
      if (useGlobalHeightCheckbox.checked) this.instances.setHeight(this.selectedInstanceId, null);
    });
    heightInput.addEventListener('change', () => {
      if (!this.selectedInstanceId || useGlobalHeightCheckbox.checked) return;
      const height = parseFloat(heightInput.value);
      if (Number.isFinite(height)) this.instances.setHeight(this.selectedInstanceId, height);
    });
    useGlobalWeightCheckbox.addEventListener('change', () => {
      if (!this.selectedInstanceId) return;
      weightInput.disabled = useGlobalWeightCheckbox.checked;
      if (useGlobalWeightCheckbox.checked) this.instances.setWeight(this.selectedInstanceId, null);
    });
    weightInput.addEventListener('change', () => {
      if (!this.selectedInstanceId || useGlobalWeightCheckbox.checked) return;
      const weight = parseFloat(weightInput.value);
      if (Number.isFinite(weight) && weight > 0) this.instances.setWeight(this.selectedInstanceId, weight);
    });
    deleteBtn.addEventListener('click', () => {
      if (!this.selectedInstanceId) return;
      this.instances.remove(this.selectedInstanceId);
      this.#selectInstance(null);
    });
  }

  #renderInstanceList() {
    const list = document.getElementById('placedShapesList');
    list.innerHTML = '';

    this.instances.instances.forEach((instance, index) => {
      const li = document.createElement('li');
      li.style.cursor = 'pointer';
      li.style.marginBottom = '4px';
      li.textContent = `${instance.shapeSnapshot.name || `Shape ${index + 1}`}`;
      li.style.border = instance.id === this.selectedInstanceId ? '1px solid #ffcc00' : '1px solid transparent';
      li.addEventListener('click', () => this.#selectInstance(instance.id));
      list.appendChild(li);
    });

    if (this.instances.count === 0) {
      const li = document.createElement('li');
      li.textContent = 'No shapes placed yet.';
      li.style.color = 'var(--panel-text-muted, #888)';
      list.appendChild(li);
    }
  }

  #selectInstance(id) {
    this.selectedInstanceId = id;
    this.#renderInstanceList();

    const panel = document.getElementById('instanceEditPanel');
    const instance = id ? this.instances.findById(id) : null;
    panel.style.display = instance ? 'block' : 'none';
    if (!instance) return;

    document.getElementById('instanceRotationInput').value = String((instance.rotationRadians * 180) / Math.PI);
    document.getElementById('instanceScaleInput').value = String(instance.scale);
    const useGlobalHeight = instance.shapeSnapshot.height === null;
    document.getElementById('instanceUseGlobalHeightCheckbox').checked = useGlobalHeight;
    const heightInput = document.getElementById('instanceHeightInput');
    heightInput.disabled = useGlobalHeight;
    heightInput.value = String(instance.shapeSnapshot.height ?? this.globalHeight);

    const useGlobalWeight = instance.shapeSnapshot.weight === null;
    document.getElementById('instanceUseGlobalWeightCheckbox').checked = useGlobalWeight;
    const weightInput = document.getElementById('instanceWeightInput');
    weightInput.disabled = useGlobalWeight;
    weightInput.value = String(instance.shapeSnapshot.weight ?? this.globalWeight);
  }

  #initCameraReset() {
    document.getElementById('resetCameraBtn').addEventListener('click', () => this.#applyDefaultCameraView());
  }

  #syncScene() {
    this.arrangeSceneSync.syncAll(this.instances.instances, this.globalHeight, this.globalWeight);
  }

  #raycastToBoard(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);
    this._raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.camera);
    const hit = this._raycaster.ray.intersectPlane(this._groundPlane, this._hitPoint);
    return hit ? fromWorld3({ x: hit.x, y: hit.y, z: hit.z }) : null;
  }

  /** The placed instance whose own centroid is nearest `point2`, within its own on-board radius (or `MIN_INSTANCE_PICK_RADIUS`, whichever is larger) - the Arrange board's "click near a shape" pick, approximate rather than a true raycast against each instance's thin line geometry. */
  #findInstanceNear(point2) {
    let best = null;
    let bestDist = Infinity;
    for (const instance of this.instances.instances) {
      const d = Math.hypot(instance.position.x - point2.x, instance.position.y - point2.y);
      const radius = Math.max(this.#instanceRadius(instance), MIN_INSTANCE_PICK_RADIUS);
      if (d <= radius && d < bestDist) {
        bestDist = d;
        best = instance;
      }
    }
    return best;
  }

  #instanceRadius(instance) {
    const anchors = instance.shapeSnapshot.anchors;
    const centroid = anchorsCentroid(anchors);
    let maxDist = 0;
    for (const anchor of anchors) {
      maxDist = Math.max(maxDist, Math.hypot(anchor.x - centroid.x, anchor.y - centroid.y));
    }
    return maxDist * instance.scale;
  }

  #handlePointerDown = (event) => {
    const hit = this.#raycastToBoard(event.clientX, event.clientY);
    if (!hit) return;

    if (this.armedShapeId) {
      const shape = this.library.findById(this.armedShapeId);
      if (shape) {
        this.instances.add({
          id: generateId(),
          shapeId: shape.id,
          shapeSnapshot: FreeformShape.fromJSON(shape.toJSON()),
          position: hit,
        });
      }
      return;
    }

    const nearest = this.#findInstanceNear(hit);
    this.#selectInstance(nearest ? nearest.id : null);
    this.dragState = nearest ? { id: nearest.id } : null;
  };

  #handlePointerMove = (event) => {
    if (!this.dragState) return;
    const hit = this.#raycastToBoard(event.clientX, event.clientY);
    if (!hit) return;
    this.instances.move(this.dragState.id, hit);
  };

  #handlePointerUp = () => {
    this.dragState = null;
  };

  #createScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);
  }

  #createCamera() {
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, aspect, CAMERA_NEAR, CAMERA_FAR);
    this.#applyDefaultCameraView();
  }

  #applyDefaultCameraView() {
    const position = defaultCameraPosition(BOARD_SIZE, BOARD_SIZE, CAMERA_FOV);
    this.camera.position.set(position.x, position.y, position.z);
    this.camera.lookAt(ORBIT_TARGET.x, ORBIT_TARGET.y, ORBIT_TARGET.z);
    if (this.controls) {
      this.controls.target.set(ORBIT_TARGET.x, ORBIT_TARGET.y, ORBIT_TARGET.z);
      this.controls.update();
    }
  }

  #createRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  #createControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(ORBIT_TARGET.x, ORBIT_TARGET.y, ORBIT_TARGET.z);
    this.controls.enableDamping = true;
  }

  #createLighting() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(400, 800, 500);
    this.scene.add(directional);
  }

  #handleResize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.arrangeSceneSync.setViewportSize(width, height);
  };

  #animate = () => {
    requestAnimationFrame(this.#animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.gizmo.render(this.renderer, this.camera);
  };
}
