import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CardioidSceneSync } from './CardioidSceneSync.js';
import { StrokePalette } from '../state/StrokePalette.js';
import { FavoritesStore } from '../state/FavoritesStore.js';
import { ColorPickerUI } from '../ui/ColorPickerUI.js';
import { PickerModeUI } from '../ui/PickerModeUI.js';
import { FavoritesUI } from '../ui/FavoritesUI.js';
import { ColorCountUI } from '../ui/ColorCountUI.js';
import { PanelGroup } from '../ui/PanelGroup.js';
import { MenuUI } from '../ui/MenuUI.js';
import { initPanelResizers } from '../ui/PanelResizer.js';
import { initThemeToggle } from '../three-page/ThemeToggle.js';
import { OrientationGizmo } from '../three-page/OrientationGizmo.js';
import { defaultCameraPosition } from '../three-page/cameraFraming.js';
import { CardioidShape } from '../models/CardioidShape.js';
import { ShapeLibraryStore } from '../state/ShapeLibraryStore.js';
import { saveToStorage, loadFromStorage } from '../io/BrowserStorage.js';
import { CARDIOID_LIBRARY_STORAGE_KEY } from '../io/storageKeys.js';
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
  // Thread numbers run 1 .. nailCount, so their max follows the nail count.
  { id: 'rangeStartInput', key: 'rangeStart', integer: true, min: 1, max: (s) => s.nailCount },
  { id: 'rangeEndInput', key: 'rangeEnd', integer: true, min: 1, max: (s) => s.nailCount },
  { id: 'heightInput', key: 'height', min: 10, max: 5000 },
];

/**
 * The Cardioid board page: one circle of nails, woven as a times table
 * (nail j to nail multiplier*j - cardioid at 2) and stacked into layers that
 * are each the same pattern rotated by `leap` nails. Thread and nails are
 * real-size (10 world units = 1 mm), sharing Arrange's thread width, nail
 * width and 8/O wrap (see `ui/ThreadSettingsUI.js`). Every number in the weave is a field
 * in the menu; the layer's colors are split into equal arcs of the circle
 * (see `core/cardioidWeave.js`).
 *
 * Same Three.js scaffolding as `ArrangeApp.js` (scene/camera/orbit/
 * lighting/gizmo), minus anything about placing shapes.
 */
export class CardioidApp {
  constructor() {
    this.settings = {
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
      rangeStart: 1, // visible threads, 1-based and inclusive; 1 .. nailCount = all
      rangeEnd: 48,
    };
    // Real thread width / nail width / 8-or-O wrap in mm, shared with Arrange.
    this.thread = loadThreadSettings();
    this.library = new ShapeLibraryStore();
    this.palette = new StrokePalette(); // one slot per color group a layer is split into
    this.palette.resize(2);
    this.palette.setColor(1, '#ffffff'); // second color defaults to white
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
    this.#applyDefaultCameraView();

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
    this.#initColors();
    document.getElementById('resetCameraBtn').addEventListener('click', () => this.#applyDefaultCameraView());

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
        if (field.key === 'nailCount') this.#fitRangeToNailCount(previousNailCount);
        if (field.refit) this.#applyDefaultCameraView();
        this.#rebuild();
      });
    }
  }

  /** A full range stays full when the nail count changes; a part range is kept, clipped to the new count. */
  #fitRangeToNailCount(previousNailCount) {
    const nailCount = this.settings.nailCount;
    const wasFull = this.settings.rangeStart === 1 && this.settings.rangeEnd === previousNailCount;
    this.settings.rangeStart = Math.min(this.settings.rangeStart, nailCount);
    this.settings.rangeEnd = wasFull ? nailCount : Math.min(this.settings.rangeEnd, nailCount);
    this.#showSettingsInFields();
  }

  /** Writes every setting back into its menu field - after loading a saved cardioid, or when one setting moves another. */
  #showSettingsInFields() {
    for (const field of FIELDS) document.getElementById(field.id).value = String(this.settings[field.key]);
    document.getElementById('directionSelect').value = this.settings.direction;
    document.getElementById('outlineSelect').value = this.settings.outline;
    document.getElementById('stretchInput').disabled = this.settings.outline !== 'ellipse';
  }

  /** Thread range "Show all", counting direction, and circle/ellipse. */
  #initPartAndOutline() {
    document.getElementById('rangeAllBtn').addEventListener('click', () => {
      this.settings.rangeStart = 1;
      this.settings.rangeEnd = this.settings.nailCount;
      this.#showSettingsInFields();
      this.#rebuild();
    });
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

  /** Visible thread range, or null when every thread shows. */
  get #range() {
    const { rangeStart, rangeEnd, nailCount } = this.settings;
    return rangeStart === 1 && rangeEnd === nailCount ? null : { start: rangeStart, end: rangeEnd };
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
      const range = this.#range;
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
        rangeStart: range ? range.start : null,
        rangeEnd: range ? range.end : null,
        colors: this.palette.snapshot(),
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
      const part = shape.range ? `, threads ${shape.range.start}-${shape.range.end}` : '';
      label.textContent = `${shape.name} (nails=${shape.nailCount}, layers=${shape.layerCount}${part})`;
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

  /** Puts a saved cardioid's settings and colors back on the page. */
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
      rangeStart: shape.range ? shape.range.start : 1,
      rangeEnd: shape.range ? shape.range.end : shape.nailCount,
    });
    this.#showSettingsInFields();
    if (shape.colors.length > 0) {
      this.palette.resize(shape.colors.length);
      shape.colors.forEach((c, i) => {
        this.palette.setColor(i, c.color);
        if (this.palette.getSlot(i).enabled !== Boolean(c.enabled)) this.palette.toggleEnabled(i);
      });
      this.colorPickerUI.rebuild();
      this.colorCountUI.setCount(shape.colors.length);
    }
    this.#applyDefaultCameraView();
    this.#rebuild();
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

  /** The colors a layer is split into: swatches, a count field, Default/Custom picker mode, and saved color schemes - the same UI classes the other pages use. */
  #initColors() {
    this.palette.onChange(() => this.#rebuild());

    this.colorPickerUI = new ColorPickerUI(document.getElementById('colorPickerContainer'), this.palette);
    this.colorPickerUI.init();
    new PickerModeUI(
      { defaultBtn: document.getElementById('pickerModeDefaultBtn'), customBtn: document.getElementById('pickerModeCustomBtn') },
      this.colorPickerUI
    ).init();

    const colorCountUI = (this.colorCountUI = new ColorCountUI(
      { input: document.getElementById('colorCountInput'), applyBtn: document.getElementById('applyColorCountBtn') },
      this.palette.size,
      (count) => {
        this.palette.resize(count);
        this.colorPickerUI.rebuild();
      }
    ));
    colorCountUI.init();

    // The schemes flyout is `position: fixed` (see cardioid/index.html) so the
    // scrolling main menu can't clip it - line it up just right of that menu
    // each time it's opened.
    const schemesPanel = document.getElementById('colorFavoritesSubmenu');
    document.getElementById('openFavoritesBtn').addEventListener('click', () => {
      const menu = document.getElementById('ui').getBoundingClientRect();
      schemesPanel.style.top = `${menu.top}px`;
      schemesPanel.style.left = `${menu.right + 10}px`;
    });
    new FavoritesUI(
      {
        panelEl: schemesPanel,
        openBtn: document.getElementById('openFavoritesBtn'),
        closeBtn: document.getElementById('closeColorSubmenuBtn'),
        saveBtn: document.getElementById('saveCurrentColorBtn'),
        exportBtn: document.getElementById('exportColorsBtn'),
        importBtn: document.getElementById('importColorsBtn'),
        importInput: document.getElementById('importColorsInput'),
        bundlesContainer: document.getElementById('favoriteBundlesContainer'),
      },
      new FavoritesStore(),
      this.palette,
      this.colorPickerUI,
      new PanelGroup(),
      (count) => colorCountUI.setCount(count)
    ).init();
  }

  #rebuild() {
    this.sceneSync.rebuild({
      ...this.settings, stretch: this.#stretch, range: this.#range, colors: this.palette.getEnabledColors(), thread: this.thread,
    });
    this.#showRealSize();
    this.sceneSync.setViewportSize(window.innerWidth, window.innerHeight);
  }

  #applyDefaultCameraView() {
    const size = CardioidSceneSync.boardSizeFor(this.settings.radius, this.#stretch);
    const position = defaultCameraPosition(size, size, CAMERA_FOV);
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
