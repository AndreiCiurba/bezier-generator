import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CardioidSceneSync } from './CardioidSceneSync.js';
import { CardioidRunStore } from '../state/CardioidRunStore.js';
import { CardioidRunsUI } from '../ui/CardioidRunsUI.js';
import { DEFAULT_RUN_GAP_MM } from '../models/cardioidRun.js';
import { MenuUI } from '../ui/MenuUI.js';
import { initPanelResizers } from '../ui/PanelResizer.js';
import { initThemeToggle } from '../three-page/ThemeToggle.js';
import { OrientationGizmo } from '../three-page/OrientationGizmo.js';
import { defaultCameraPosition, topCameraPosition } from '../three-page/cameraFraming.js';
import { CardioidShape } from '../models/CardioidShape.js';
import { ShapeLibraryStore } from '../state/ShapeLibraryStore.js';
import { saveToStorage, loadFromStorage } from '../io/BrowserStorage.js';
import { CARDIOID_LIBRARY_STORAGE_KEY, CARDIOID_PAGE_STORAGE_KEY } from '../io/storageKeys.js';
import { mergeSavedSettings } from '../io/mergeSavedSettings.js';
import { cameraSnapshot, restoreCamera } from '../three-page/cameraMemory.js';
import { generateId } from '../utils/id.js';
import { ThreadSettingsUI, loadThreadSettings } from '../ui/ThreadSettingsUI.js';
import { worldToCm } from '../core/threadWrap.js';
const CAMERA_FOV = 50;
const CAMERA_NEAR = 1;
const CAMERA_FAR = 100000;
const ORBIT_TARGET = { x: 0, y: 0, z: 0 };

// Each field: its input id, the settings key it drives, and what it accepts.
// `integer` fields reject fractions; anything outside [min, max] is refused
// and the field snaps back to the last good value.
const FIELDS = [
  { id: 'nailCountInput', key: 'nailCount', integer: true, min: 3, max: 1000 },
  { id: 'layerCountInput', key: 'layerCount', integer: true, min: 1, max: 60 },
  { id: 'leapInput', key: 'leap', integer: true, min: 0, max: 1000 },
  { id: 'multiplierInput', key: 'multiplier', integer: true, min: 1, max: 100 },
  { id: 'radiusInput', key: 'radius', min: 100, max: 20000, refit: true },
  { id: 'stretchInput', key: 'stretch', min: 0.1, max: 10, refit: true },
  { id: 'heightInput', key: 'height', min: 10, max: 5000 },
  { id: 'runGapInput', key: 'runGapMm', min: 0, max: 10 },
];

/**
 * The Cardioid board page: one circle of nails, woven as a times table
 * (nail j to nail multiplier*j - cardioid at 2) and stacked into layers that
 * are each the same pattern rotated by `leap` nails. Thread and nails are
 * real-size (10 world units = 1 mm), sharing Arrange's thread width, nail
 * width and 8/O wrap (see `ui/ThreadSettingsUI.js`). Every number in the weave is a field
 * in the menu. Each layer is a stack of runs - part cardioids with their own
 * range, start nail, color and optional multiplier/leap, strung one on top
 * of the other (see `core/cardioidWeave.js`).
 *
 * Same Three.js scaffolding as `ArrangeApp.js` (scene/camera/orbit/
 * lighting/gizmo), minus anything about placing shapes.
 */
export class CardioidApp {
  constructor() {
    const defaults = {
      nailCount: 48,
      layerCount: 48,
      leap: 1,
      multiplier: 2,
      radius: 3000,
      height: 2000,
      nailsVisible: false,
      showWrap: true,
      outline: 'circle', // or 'ellipse', which applies `stretch`
      stretch: 1.5,
      direction: 'cw',
      runGapMm: DEFAULT_RUN_GAP_MM, // how far each run of a layer's stack sits above the one before
    };
    // Everything as it was last left on this page (settings, runs, camera), else the defaults.
    this.saved = loadFromStorage(CARDIOID_PAGE_STORAGE_KEY);
    this.settings = mergeSavedSettings(defaults, this.saved?.settings);
    // Real thread width / nail width / 8-or-O wrap in mm, shared with Arrange.
    this.thread = loadThreadSettings();
    this.library = new ShapeLibraryStore();
    this.runs = new CardioidRunStore(this.settings.nailCount);
    if (Array.isArray(this.saved?.runs)) this.runs.setAll(this.saved.runs, this.settings.nailCount);
  }

  init() {
    this.canvas = document.getElementById('cardioid-canvas');
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);
    this.sceneSync = new CardioidSceneSync(this.scene);

    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, window.innerWidth / window.innerHeight, CAMERA_NEAR, CAMERA_FAR);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    if (!restoreCamera(this.camera, this.controls, this.saved?.camera)) this.#applyTopView();
    this.controls.addEventListener('end', () => this.#saveState());
    window.addEventListener('pagehide', () => this.#saveState());

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(400, 800, 500);
    this.scene.add(directional);
    this.gizmo = new OrientationGizmo();

    new MenuUI(document.getElementById('burger'), document.getElementById('ui'), document.getElementById('closeUiBtn')).init();
    initPanelResizers();
    initThemeToggle();

    this.#initFields();
    this.#initPartAndOutline();
    this.#initLibrary();
    this.#initNailsToggle();
    this.#initWrapToggle();
    this.#initThreadSettings();
    this.#initRuns();
    document.getElementById('resetCameraBtn').addEventListener('click', () => {
      this.#applyTopView();
      this.#saveState();
    });
    document.getElementById('angledViewBtn').addEventListener('click', () => {
      this.#applyAngledView();
      this.#saveState();
    });

    window.addEventListener('resize', this.#handleResize);
    this.#handleResize();
    this.#rebuild();
    this.#animate();
  }

  #initFields() {
    for (const field of FIELDS) {
      const input = document.getElementById(field.id);
      input.value = String(this.settings[field.key]);
      input.addEventListener('change', () => {
        const value = Number(input.value);
        const max = typeof field.max === 'function' ? field.max(this.settings) : field.max;
        const valid = Number.isFinite(value) && value >= field.min && value <= max && (!field.integer || Number.isInteger(value));
        if (!valid || input.value.trim() === '') {
          input.value = String(this.settings[field.key]);
          return;
        }
        const previousNailCount = this.settings.nailCount;
        this.settings[field.key] = value;
        if (field.key === 'nailCount') this.runs.fitToNailCount(previousNailCount, value); // rebuilds via onChange
        if (field.refit) this.#applyDefaultCameraView();
        this.runsUI.refreshPreviews(); // the shared multiplier shows in each run's preview
        this.#rebuild();
      });
    }
  }

  /** Writes every setting back into its menu field - after loading a saved cardioid, or when one setting moves another. */
  #showSettingsInFields() {
    for (const field of FIELDS) document.getElementById(field.id).value = String(this.settings[field.key]);
    document.getElementById('directionSelect').value = this.settings.direction;
    document.getElementById('outlineSelect').value = this.settings.outline;
    document.getElementById('stretchInput').disabled = this.settings.outline !== 'ellipse';
  }

  /** Counting direction, and circle/ellipse. */
  #initPartAndOutline() {
    const directionSelect = document.getElementById('directionSelect');
    directionSelect.addEventListener('change', () => {
      this.settings.direction = directionSelect.value === 'ccw' ? 'ccw' : 'cw';
      this.#rebuild();
    });
    const outlineSelect = document.getElementById('outlineSelect');
    outlineSelect.addEventListener('change', () => {
      this.settings.outline = outlineSelect.value === 'ellipse' ? 'ellipse' : 'circle';
      this.#showSettingsInFields();
      this.#applyDefaultCameraView();
      this.#rebuild();
    });
    this.#showSettingsInFields();
  }

  /** Ellipse stretch actually in effect (1 for a circle). */
  get #stretch() {
    return this.settings.outline === 'ellipse' ? this.settings.stretch : 1;
  }

  /**
   * Save to Library + the list of saved cardioids (click one to load it back,
   * x to delete it). Saved in this browser under its own key, which the
   * Arrange page also reads, so a saved cardioid is ready to place there.
   */
  #initLibrary() {
    const load = () => {
      const raw = loadFromStorage(CARDIOID_LIBRARY_STORAGE_KEY);
      this.library.clear();
      if (Array.isArray(raw)) this.library.importShapes(raw, CardioidShape);
    };
    const save = () => saveToStorage(CARDIOID_LIBRARY_STORAGE_KEY, this.library.shapes.map((s) => s.toJSON()));
    this.library.onChange(() => this.#renderLibraryList());
    load();
    // Arrange can delete from this library too.
    window.addEventListener('storage', (event) => {
      if (event.key === null || event.key.endsWith(CARDIOID_LIBRARY_STORAGE_KEY)) load();
    });
    this.saveLibrary = save;

    const nameInput = document.getElementById('cardioidNameInput');
    document.getElementById('saveCardioidBtn').addEventListener('click', () => {
      const shape = new CardioidShape({
        id: generateId(),
        name: nameInput.value.trim() || `Cardioid_${this.library.count + 1}`,
        nailCount: this.settings.nailCount,
        layerCount: this.settings.layerCount,
        leap: this.settings.leap,
        multiplier: this.settings.multiplier,
        radius: this.settings.radius,
        stretch: this.#stretch,
        direction: this.settings.direction,
        runs: this.runs.runs,
        runGapMm: this.settings.runGapMm,
        // Arrange sizes it with its own placement size and global height.
        height: null,
      });
      this.library.add(shape);
      save();
      nameInput.value = '';
    });
  }

  #renderLibraryList() {
    const list = document.getElementById('cardioidLibraryList');
    list.innerHTML = '';
    for (const shape of this.library.shapes) {
      const li = document.createElement('li');
      li.style.cssText = 'cursor:pointer; margin-bottom:4px; display:flex; align-items:center; gap:4px;';
      li.title = 'Load these settings';
      const label = document.createElement('span');
      label.style.flex = '1';
      label.textContent = `${shape.name} (nails=${shape.nailCount}, layers=${shape.layerCount}, runs=${shape.runs.length})`;
      const removeBtn = document.createElement('button');
      removeBtn.className = 'panel-close-btn';
      removeBtn.style.position = 'static';
      removeBtn.textContent = '×';
      removeBtn.title = 'Delete from library';
      removeBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        if (!confirm(`Delete "${shape.name}" from the library?`)) return;
        this.library.remove(shape.id);
        this.saveLibrary();
      });
      li.append(label, removeBtn);
      li.addEventListener('click', () => this.#loadShape(shape));
      list.appendChild(li);
    }
    if (this.library.count === 0) {
      const li = document.createElement('li');
      li.textContent = 'Nothing saved yet.';
      li.style.color = 'var(--panel-text-muted, #888)';
      list.appendChild(li);
    }
  }

  /** Puts a saved cardioid's settings and runs back on the page. */
  #loadShape(shape) {
    Object.assign(this.settings, {
      nailCount: shape.nailCount,
      layerCount: shape.layerCount,
      leap: shape.leap,
      multiplier: shape.multiplier,
      radius: shape.radius,
      outline: shape.stretch === 1 ? 'circle' : 'ellipse',
      stretch: shape.stretch === 1 ? this.settings.stretch : shape.stretch,
      direction: shape.direction,
      runGapMm: shape.runGapMm,
    });
    this.#showSettingsInFields();
    this.#applyDefaultCameraView();
    this.runs.setAll(shape.runs, shape.nailCount); // rebuilds via onChange
  }

  #initNailsToggle() {
    const checkbox = document.getElementById('showNailsCheckbox');
    checkbox.checked = this.settings.nailsVisible;
    checkbox.addEventListener('change', () => {
      this.settings.nailsVisible = checkbox.checked;
      this.#rebuild();
    });
  }

  /** "Show thread wrap": draws the arc where each thread turns around its nail. */
  #initWrapToggle() {
    const checkbox = document.getElementById('showWrapCheckbox');
    checkbox.checked = this.settings.showWrap;
    checkbox.addEventListener('change', () => {
      this.settings.showWrap = checkbox.checked;
      this.#rebuild();
    });
  }

  /** Thread width, nail width and 8/O wrap - the same fields and saved values as on Arrange. */
  #initThreadSettings() {
    new ThreadSettingsUI(
      {
        threadInput: document.getElementById('threadWidthInput'),
        nailInput: document.getElementById('nailDiameterInput'),
        wrapSelect: document.getElementById('wrapTechniqueSelect'),
      },
      () => this.thread,
      (thread) => {
        this.thread = thread;
        this.#rebuild();
      }
    ).init();
  }

  /** Real-life size of the nail ring and layer stack, so the world units mean something. */
  #showRealSize() {
    const { radius, height } = this.settings;
    const cm = (units) => Number(worldToCm(units).toFixed(1));
    const across = this.#stretch === 1
      ? `${cm(2 * radius)} cm across`
      : `${cm(2 * radius * this.#stretch)} x ${cm(2 * radius)} cm`;
    document.getElementById('realSizeLabel').textContent =
      `Nail ring ${across}, layers ${cm(height)} cm tall (10 units = 1 mm).`;
  }

  /** The run stack every layer is woven from: the runs list plus "Add run". */
  #initRuns() {
    this.runs.onChange(() => this.#rebuild());
    this.runsUI = new CardioidRunsUI(document.getElementById('runsContainer'), this.runs, () => ({
      nailCount: this.settings.nailCount, multiplier: this.settings.multiplier,
    }));
    this.runsUI.init();
    document.getElementById('addRunBtn').addEventListener('click', () => this.runs.add(this.settings.nailCount));
  }

  #rebuild() {
    this.sceneSync.rebuild({
      ...this.settings, stretch: this.#stretch, runs: this.runs.runs, thread: this.thread,
    });
    this.#showRealSize();
    this.sceneSync.setViewportSize(window.innerWidth, window.innerHeight);
    this.#saveState();
  }

  /** Remembers the page exactly as it is (settings, runs, camera), so coming back from another page finds it unchanged. */
  #saveState() {
    if (!this.controls) return;
    saveToStorage(CARDIOID_PAGE_STORAGE_KEY, {
      settings: this.settings, runs: this.runs.runs, camera: cameraSnapshot(this.camera, this.controls),
    });
  }

  /** "Reset Camera": straight down onto the board, all of it in view. Also used whenever the board's size changes. */
  #applyDefaultCameraView() {
    this.#applyTopView();
  }

  #applyTopView() {
    const size = CardioidSceneSync.boardSizeFor(this.settings.radius, this.#stretch);
    this.#placeCamera(topCameraPosition(size, size, CAMERA_FOV));
  }

  /** The oblique three-quarter view. */
  #applyAngledView() {
    const size = CardioidSceneSync.boardSizeFor(this.settings.radius, this.#stretch);
    this.#placeCamera(defaultCameraPosition(size, size, CAMERA_FOV));
  }

  #placeCamera(position) {
    this.camera.position.set(position.x, position.y, position.z);
    this.camera.lookAt(ORBIT_TARGET.x, ORBIT_TARGET.y, ORBIT_TARGET.z);
    this.controls.target.set(ORBIT_TARGET.x, ORBIT_TARGET.y, ORBIT_TARGET.z);
    this.controls.update();
  }

  #handleResize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.sceneSync.setViewportSize(width, height);
  };

  #animate = () => {
    requestAnimationFrame(this.#animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.gizmo.render(this.renderer, this.camera);
  };
}
