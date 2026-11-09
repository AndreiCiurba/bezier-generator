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
import { OrientationGizmo } from '../three-page/OrientationGizmo.js';
import { defaultCameraPosition } from '../three-page/cameraFraming.js';

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
  { id: 'heightInput', key: 'height', min: 10, max: 5000 },
  { id: 'bottomWeightInput', key: 'bottomWeight', min: 0.01, max: 30 },
  { id: 'topWeightInput', key: 'topWeight', min: 0.01, max: 30 },
  { id: 'nailScaleInput', key: 'nailScale', min: 0.1, max: 20 },
];

/**
 * The Cardioid board page: one circle of nails, woven as a times table
 * (nail j to nail multiplier*j - cardioid at 2) and stacked into layers that
 * are each the same pattern rotated by `leap` nails, thick string at the
 * bottom tapering to thin at the top. Every number in the weave is a field
 * in the menu; the layer's colors are split into equal arcs of the circle
 * (see `core/cardioidWeave.js`).
 *
 * Same Three.js scaffolding as `ArrangeApp.js` (scene/camera/orbit/
 * lighting/gizmo), minus anything about placing shapes.
 */
export class CardioidApp {
  constructor() {
    this.settings = {
      nailCount: 120,
      layerCount: 6,
      leap: 1,
      multiplier: 2,
      radius: 3000,
      height: 1000,
      bottomWeight: 0.9,
      topWeight: 0.2,
      nailsVisible: true,
      nailScale: 1,
    };
    this.palette = new StrokePalette(); // one slot per color group a layer is split into
    this.palette.resize(2);
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

    this.#initFields();
    this.#initNailsToggle();
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
        const valid = Number.isFinite(value) && value >= field.min && value <= field.max && (!field.integer || Number.isInteger(value));
        if (!valid || input.value.trim() === '') {
          input.value = String(this.settings[field.key]);
          return;
        }
        this.settings[field.key] = value;
        if (field.refit) this.#applyDefaultCameraView();
        this.#rebuild();
      });
    }
  }

  #initNailsToggle() {
    const checkbox = document.getElementById('showNailsCheckbox');
    checkbox.checked = this.settings.nailsVisible;
    checkbox.addEventListener('change', () => {
      this.settings.nailsVisible = checkbox.checked;
      this.#rebuild();
    });
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

    const colorCountUI = new ColorCountUI(
      { input: document.getElementById('colorCountInput'), applyBtn: document.getElementById('applyColorCountBtn') },
      this.palette.size,
      (count) => {
        this.palette.resize(count);
        this.colorPickerUI.rebuild();
      }
    );
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
    this.sceneSync.rebuild({ ...this.settings, colors: this.palette.getEnabledColors() });
    this.sceneSync.setViewportSize(window.innerWidth, window.innerHeight);
  }

  #applyDefaultCameraView() {
    const size = CardioidSceneSync.boardSizeFor(this.settings.radius);
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
