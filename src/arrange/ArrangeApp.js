import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ShapeLibraryStore } from '../state/ShapeLibraryStore.js';
import { ArrangedShapeStore } from '../state/ArrangedShapeStore.js';
import { FreeformShape } from '../models/FreeformShape.js';
import { anchorsCentroid } from '../core/shapeTransform.js';
import { ArrangeSceneSync } from './ArrangeSceneSync.js';
import { MenuUI } from '../ui/MenuUI.js';
import { initPanelResizers } from '../ui/PanelResizer.js';
import { initThemeToggle } from '../three-page/ThemeToggle.js';
import { NailHeightUI } from '../three-page/NailHeightUI.js';
import { StrokeWeightUI } from '../ui/StrokeWeightUI.js';
import { StrokePalette } from '../state/StrokePalette.js';
import { FavoritesStore } from '../state/FavoritesStore.js';
import { ColorPickerUI } from '../ui/ColorPickerUI.js';
import { PickerModeUI } from '../ui/PickerModeUI.js';
import { FavoritesUI } from '../ui/FavoritesUI.js';
import { PanelGroup } from '../ui/PanelGroup.js';
import { OrientationGizmo } from '../three-page/OrientationGizmo.js';
import { defaultCameraPosition } from '../three-page/cameraFraming.js';
import { fromWorld3 } from '../three-page/axisMapping.js';
import { downloadJson, readJsonFile } from '../io/JsonFile.js';
import { downloadCanvasPng } from '../io/PngFile.js';
import { arrangeExportGeometry, renderArrangeExport } from './arrangeExport.js';
import { shapeExtent, scaleForTargetSize } from './placementSize.js';
import { transformAnchors } from '../core/shapeTransform.js';
import { resampleClosedOutline } from '../core/bezierOutline.js';
import { generateId } from '../utils/id.js';
import { saveToStorage, loadFromStorage, clearFromStorage } from '../io/BrowserStorage.js';
import { SHAPE_LIBRARY_STORAGE_KEY, ARRANGEMENT_STORAGE_KEY } from '../io/storageKeys.js';

// Scaled 10x (was 1200) for the same reason as the Shapes page's own
// PRESET_RADIUS (see ShapeDesignerApp.js) - real room for a thin
// (0.01-floor) string to read as thin. Safe to take the full 10x here too:
// it's a `THREE.BoxGeometry` size, not a 2D canvas backing-buffer dimension,
// so there's no memory-blowup risk the way a literal 10x would have on the
// Grid page - `defaultCameraPosition` below re-frames to fit automatically.
const DEFAULT_BOARD_WIDTH = 12000;
const DEFAULT_BOARD_DEPTH = 12000;
const MIN_BOARD_SIDE = 100;
const MAX_BOARD_SIDE = 200000;
const CAMERA_FOV = 50;
const CAMERA_NEAR = 1;
const CAMERA_FAR = 1000000;
const ORBIT_TARGET = { x: 0, y: 0, z: 0 };
// An instance too small to have any own-radius worth clicking precisely
// (e.g. a brand-new, un-scaled tiny shape) still needs a minimum pick
// tolerance - same reasoning as the 2D pages' own NEAREST_NAIL_RADIUS, scaled
// 10x alongside the default board size.
const MIN_INSTANCE_PICK_RADIUS = 200;
// This board's own defaults (the 3D page's 400 / baseline weight don't suit
// the big freeform shapes placed here).
const DEFAULT_ARRANGE_HEIGHT = 1000;
const DEFAULT_ARRANGE_WEIGHT = 0.3;
// A shape's drawing size on /shapes (its pixel canvas) says nothing about how
// big it should be on this board, so every placement is sized to a target
// length for its longest side instead (see placementSize.js) - chosen with the
// "Placement Size" slider, still freely editable per instance afterwards.
const DEFAULT_PLACEMENT_SIZE = 1500;

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
 *
 * Phase 1 of `docs/persistence-plan.md`: `this.library` hydrates from the
 * *same* `localStorage` key `/shapes/` writes its committed library to (see
 * `#hydrateLibrary`) - same-origin pages already share `localStorage`, so a
 * shape committed there is already here with no file import needed. This
 * page never writes that key back (it only ever reads/places from the
 * library, never edits it) - importing a JSON file still works too, as a
 * secondary way to load shapes. `this.instances` (the placed arrangement)
 * auto-persists to its own key the same way `/shapes/`'s draft does.
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

    this.globalHeight = DEFAULT_ARRANGE_HEIGHT;
    this.globalWeight = DEFAULT_ARRANGE_WEIGHT;
    this.globalNailsVisible = true;
    this.boardWidth = DEFAULT_BOARD_WIDTH;
    this.boardDepth = DEFAULT_BOARD_DEPTH;
    this.armedShapeId = null; // library shape id selected for the next placement click
    this.selectedInstanceId = null; // placed instance id currently shown in the edit panel
    this.dragState = null; // { id } while a placed instance is being dragged
    this.isPlacementMode = false;

    this._raycaster = new THREE.Raycaster();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._hitPoint = new THREE.Vector3();
  }

  init() {
    // Must run before any UI wiring reads this.library/this.instances for
    // their initial render.
    this.#hydrateLibrary();
    this.#hydrateInstances();

    this.canvas = document.getElementById('arrange-canvas');
    this.#createScene();
    this.arrangeSceneSync = new ArrangeSceneSync(this.scene, this.boardWidth, this.boardDepth);
    this.#createCamera();
    this.#createRenderer();
    this.#createControls();
    this.#createLighting();
    this.gizmo = new OrientationGizmo();

    new MenuUI(document.getElementById('burger'), document.getElementById('ui'), document.getElementById('closeUiBtn')).init();
    initPanelResizers();
    initThemeToggle();

    this.#initPlacementModeToggle();
    this.#initLibraryImportExport();
    this.#initLibrarySync();
    this.#initPlacementSize();
    this.#initGlobalHeight();
    this.#initGlobalWeight();
    this.#initGlobalNails();
    this.#initBoardSize();
    this.#initArrangementExportImport();
    this.#initPngExport();
    this.#initInstanceEditPanel();
    this.#initInstanceColors();
    this.#initCameraReset();
    this.#initPersistenceControls();

    this.library.onChange(() => this.#renderLibraryList());
    this.instances.onChange(() => {
      this.#renderInstanceList();
      this.#syncScene();
      saveToStorage(ARRANGEMENT_STORAGE_KEY, this.instances.toJSON());
    });
    this.#renderLibraryList();
    this.#renderInstanceList();
    this.#syncScene();

    window.addEventListener('resize', this.#handleResize);
    this.#handleResize();
    this.#animate();
  }

  /** Restores the shape library from the same `localStorage` key `/shapes/` writes to - see this class's own doc. Read-only: never writes this key back. */
  #hydrateLibrary() {
    this.storedLibraryIds = new Set();
    this.#syncLibraryFromStorage();
  }

  /**
   * Brings the library in line with what /shapes/ last saved: shapes it saved
   * since are added, shapes it deleted are removed, and anything imported from
   * a file (never in storage) is left alone. Runs on load and then whenever
   * this page could have gone stale - the tab regains focus or becomes
   * visible, /shapes/ saves in another tab (`storage` event), or the page is
   * restored from the back/forward cache - so committed shapes simply appear,
   * with no button to press.
   */
  #syncLibraryFromStorage() {
    const raw = loadFromStorage(SHAPE_LIBRARY_STORAGE_KEY);
    const stored = Array.isArray(raw) ? raw : [];
    const storedIds = new Set(stored.map((s) => s?.id));

    for (const id of this.storedLibraryIds) {
      if (!storedIds.has(id)) this.library.remove(id);
    }
    const fresh = stored.filter((s) => s?.id && !this.library.findById(s.id));
    if (fresh.length > 0) this.library.importShapes(fresh, FreeformShape);

    this.storedLibraryIds = storedIds;
    if (this.armedShapeId && !this.library.findById(this.armedShapeId)) this.armedShapeId = null;
  }

  #initLibrarySync() {
    const sync = () => this.#syncLibraryFromStorage();
    window.addEventListener('storage', (event) => {
      if (event.key === null || event.key.endsWith(SHAPE_LIBRARY_STORAGE_KEY)) sync();
    });
    window.addEventListener('focus', sync);
    window.addEventListener('pageshow', sync);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') sync();
    });
  }

  /** Restores this board's own placed arrangement, if anything was saved for it. */
  #hydrateInstances() {
    const raw = loadFromStorage(ARRANGEMENT_STORAGE_KEY);
    if (Array.isArray(raw)) this.instances.importInstances(raw, FreeformShape);
  }

  /** "Clear Board" - wipes every placed instance (and this board's own persisted copy of them). Never touches the shared library key - that's owned by `/shapes/`. */
  #initPersistenceControls() {
    document.getElementById('clearSavedDataBtn').addEventListener('click', () => {
      clearFromStorage(ARRANGEMENT_STORAGE_KEY);
      this.instances.clear();
      this.#selectInstance(null);
    });
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
        this.#updateGhost(null);
      }
    });
  }

  #initLibraryImportExport() {
    // The "Shape Library" header button expands/collapses everything about the library (open by default).
    const libraryToggle = document.getElementById('librarySubmenuToggleBtn');
    const libraryBody = document.getElementById('librarySubmenuBody');
    libraryToggle.addEventListener('click', () => {
      libraryBody.hidden = !libraryBody.hidden;
      libraryToggle.textContent = `${libraryBody.hidden ? '▸' : '▾'} Shape Library`;
    });
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

  /** The "Placement Size" slider: how long the next placed shape's longest side will be, with a ghost outline at the cursor showing it. */
  #initPlacementSize() {
    this.placementSize = DEFAULT_PLACEMENT_SIZE;
    this.ghostLine = null;
    this.lastHit = null;
    const slider = document.getElementById('placementSizeSlider');
    slider.value = String(this.placementSize);
    slider.addEventListener('input', () => {
      this.placementSize = Number(slider.value);
      this.#updatePlacementSizeLabel();
      this.#updateGhost(this.lastHit);
    });
    this.#updatePlacementSizeLabel();

    // Ctrl + wheel over the board, in placement mode, resizes the shape about to
    // be placed (and its ghost outline) instead of zooming the camera or the
    // browser. Capture phase on the window so it runs before OrbitControls'
    // own wheel handler on the canvas and can stop it.
    window.addEventListener(
      'wheel',
      (event) => {
        if (!event.ctrlKey || !this.isPlacementMode || event.target !== this.canvas) return;
        event.preventDefault();
        event.stopPropagation();
        const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
        const min = Number(slider.min);
        const max = Number(slider.max);
        this.placementSize = Math.min(max, Math.max(min, this.placementSize * factor));
        slider.value = String(this.placementSize);
        this.#updatePlacementSizeLabel();
        this.#updateGhost(this.lastHit);
      },
      { capture: true, passive: false }
    );
  }

  #updatePlacementSizeLabel() {
    document.getElementById('placementSizeLabel').textContent =
      `Next shape: ${Math.round(this.placementSize)} units long (board is ${this.boardWidth} x ${this.boardDepth})`;
  }

  /** Scale that makes `shape` come out `placementSize` long on its longest side. */
  #scaleForPlacement(shape) {
    return scaleForTargetSize(shapeExtent(shape.resampledOutline()), this.placementSize);
  }

  /** Draws (or hides, when `hit` is null / nothing is armed) the outline the armed shape would have if placed at `hit`. */
  #updateGhost(hit) {
    const shape = this.armedShapeId ? this.library.findById(this.armedShapeId) : null;
    if (!hit || !shape || !this.isPlacementMode) {
      if (this.ghostLine) this.ghostLine.visible = false;
      return;
    }
    const anchors = transformAnchors(shape.anchors, { position: hit, rotationRadians: 0, scale: this.#scaleForPlacement(shape) });
    const outline = resampleClosedOutline(anchors, Math.max(shape.nailCount, 24));
    const points = outline.map((p) => {
      const w = this.arrangeSceneSync.toWorldPosition(p, 2);
      return new THREE.Vector3(w.x, w.y, w.z);
    });
    if (this.ghostLine) {
      this.scene.remove(this.ghostLine);
      this.ghostLine.geometry.dispose();
    } else {
      this.ghostMaterial = new THREE.LineBasicMaterial({ color: 0xc9a13c });
    }
    this.ghostLine = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), this.ghostMaterial);
    this.scene.add(this.ghostLine);
  }

  #renderLibraryList() {
    const list = document.getElementById('shapeLibraryList');
    list.innerHTML = '';
    if (!this.armedShapeId) this.#updateGhost(null);

    for (const shape of this.library.shapes) {
      const li = document.createElement('li');
      li.style.cursor = 'pointer';
      li.style.marginBottom = '4px';
      li.textContent = `${shape.name} (nails=${shape.nailCount}, leap=${shape.leap})`;
      li.style.border = shape.id === this.armedShapeId ? '1px solid var(--accent-500)' : '1px solid transparent';
      li.addEventListener('click', () => {
        this.armedShapeId = this.armedShapeId === shape.id ? null : shape.id;
        this.#renderLibraryList();
      });
      list.appendChild(li);
    }

    if (this.library.count === 0) {
      const li = document.createElement('li');
      li.textContent = 'No shapes yet - commit some on the Shapes page and they will appear here, or import a file.';
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

  /** The collapsible "Board" submenu: the board's width and height (world X and Z). Applying re-frames the camera so the whole board stays in view. */
  #initBoardSize() {
    const toggleBtn = document.getElementById('boardSubmenuToggleBtn');
    const body = document.getElementById('boardSubmenuBody');
    const widthInput = document.getElementById('boardWidthInput');
    const heightInput = document.getElementById('boardHeightInput');
    widthInput.value = String(this.boardWidth);
    heightInput.value = String(this.boardDepth);

    toggleBtn.addEventListener('click', () => {
      body.hidden = !body.hidden;
      toggleBtn.textContent = `${body.hidden ? '▸' : '▾'} Board`;
    });

    const parseSide = (input) => {
      const value = Number(input.value);
      return input.value.trim() !== '' && Number.isFinite(value) && value >= MIN_BOARD_SIDE && value <= MAX_BOARD_SIDE ? value : null;
    };
    document.getElementById('applyBoardSizeBtn').addEventListener('click', () => {
      const width = parseSide(widthInput);
      const depth = parseSide(heightInput);
      if (width === null || depth === null) {
        alert(`Board width and height must each be between ${MIN_BOARD_SIDE} and ${MAX_BOARD_SIDE}.`);
        widthInput.value = String(this.boardWidth);
        heightInput.value = String(this.boardDepth);
        return;
      }
      this.boardWidth = width;
      this.boardDepth = depth;
      this.arrangeSceneSync.setBoardSize(width, depth);
      this.#applyDefaultCameraView();
      this.#updatePlacementSizeLabel();
    });
    document.getElementById('resetBoardSizeBtn').addEventListener('click', () => {
      widthInput.value = String(DEFAULT_BOARD_WIDTH);
      heightInput.value = String(DEFAULT_BOARD_DEPTH);
      document.getElementById('applyBoardSizeBtn').click();
    });
  }

  #initGlobalNails() {
    const checkbox = document.getElementById('globalNailsVisibleCheckbox');
    checkbox.checked = this.globalNailsVisible;
    checkbox.addEventListener('change', () => {
      this.globalNailsVisible = checkbox.checked;
      this.#syncScene();
    });
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

  #initPngExport() {
    const exportPng = (filename, withStrings) => {
      const geometry = arrangeExportGeometry(this.instances.instances, this.globalWeight);
      const canvas = renderArrangeExport(geometry, { withStrings });
      if (!canvas) {
        alert('Nothing to export yet - place a shape first.');
        return;
      }
      downloadCanvasPng(canvas, filename);
    };
    document.getElementById('exportNailsPngBtn').addEventListener('click', () => exportPng('arrange-nails.png', false));
    document.getElementById('exportNailsStringsPngBtn').addEventListener('click', () => exportPng('arrange-nails-strings.png', true));
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
    const useGlobalNailsCheckbox = document.getElementById('instanceUseGlobalNailsCheckbox');
    const showNailsCheckbox = document.getElementById('instanceShowNailsCheckbox');
    const nailScaleInput = document.getElementById('instanceNailScaleInput');

    document.getElementById('instanceFitLayersCheckbox').addEventListener('change', (e) => {
      if (!this.selectedInstanceId) return;
      this.instances.setFitLayersToNails(this.selectedInstanceId, e.target.checked);
    });
    useGlobalNailsCheckbox.addEventListener('change', () => {
      if (!this.selectedInstanceId) return;
      showNailsCheckbox.disabled = useGlobalNailsCheckbox.checked;
      this.instances.setNailsVisible(this.selectedInstanceId, useGlobalNailsCheckbox.checked ? null : showNailsCheckbox.checked);
    });
    showNailsCheckbox.addEventListener('change', () => {
      if (!this.selectedInstanceId || useGlobalNailsCheckbox.checked) return;
      this.instances.setNailsVisible(this.selectedInstanceId, showNailsCheckbox.checked);
    });
    nailScaleInput.addEventListener('change', () => {
      if (!this.selectedInstanceId) return;
      const nailScale = parseFloat(nailScaleInput.value);
      if (Number.isFinite(nailScale) && nailScale > 0) this.instances.setNailScale(this.selectedInstanceId, nailScale);
    });

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
    document.getElementById('closeInstancePanelBtn').addEventListener('click', () => this.#selectInstance(null));
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

  /**
   * The selected shape's color layers, edited with the same classes the other
   * pages use. `this.instancePalette` is one reusable `StrokePalette` that
   * mirrors whichever instance is selected: loading an instance fills it
   * (guarded, so that doesn't write back), and any edit afterwards writes the
   * palette back onto just that instance.
   */
  #initInstanceColors() {
    this.instancePalette = new StrokePalette();
    this.isLoadingInstancePalette = false;

    this.colorPickerUI = new ColorPickerUI(document.getElementById('colorPickerContainer'), this.instancePalette);
    this.colorPickerUI.init();
    new PickerModeUI(
      { defaultBtn: document.getElementById('pickerModeDefaultBtn'), customBtn: document.getElementById('pickerModeCustomBtn') },
      this.colorPickerUI
    ).init();

    this.instancePalette.onChange(() => {
      if (this.isLoadingInstancePalette || !this.selectedInstanceId) return;
      this.instances.setColors(this.selectedInstanceId, this.instancePalette.snapshot());
    });

    // The schemes flyout is `position: fixed` (see arrange/index.html) so the
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
      this.instancePalette,
      this.colorPickerUI,
      new PanelGroup()
    ).init();
  }

  /** Fills `this.instancePalette` (and its swatches) from `colors` without writing anything back to the instance. */
  #loadInstancePalette(colors) {
    if (colors.length === 0) return;
    this.isLoadingInstancePalette = true;
    try {
      this.instancePalette.resize(colors.length);
      colors.forEach((c, i) => {
        this.instancePalette.setColor(i, c.color);
        if (this.instancePalette.getSlot(i).enabled !== Boolean(c.enabled)) this.instancePalette.toggleEnabled(i);
      });
    } finally {
      this.isLoadingInstancePalette = false;
    }
    this.colorPickerUI.rebuild();
  }

  #renderInstanceList() {
    const list = document.getElementById('placedShapesList');
    list.innerHTML = '';

    this.instances.instances.forEach((instance, index) => {
      const li = document.createElement('li');
      li.style.cursor = 'pointer';
      li.style.marginBottom = '4px';
      li.textContent = instance.name || `Shape_${index + 1}`;
      li.style.border = instance.id === this.selectedInstanceId ? '1px solid var(--accent-500)' : '1px solid transparent';
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

    document.getElementById('instanceFitLayersCheckbox').checked = instance.fitLayersToNails;

    const useGlobalNails = instance.nailsVisible === null;
    document.getElementById('instanceUseGlobalNailsCheckbox').checked = useGlobalNails;
    const showNailsCheckbox = document.getElementById('instanceShowNailsCheckbox');
    showNailsCheckbox.disabled = useGlobalNails;
    showNailsCheckbox.checked = instance.nailsVisible ?? this.globalNailsVisible;
    document.getElementById('instanceNailScaleInput').value = String(instance.nailScale);

    this.#loadInstancePalette(instance.shapeSnapshot.colors);
  }

  #initCameraReset() {
    document.getElementById('resetCameraBtn').addEventListener('click', () => this.#applyDefaultCameraView());
  }

  #syncScene() {
    this.arrangeSceneSync.syncAll(this.instances.instances, this.globalHeight, this.globalWeight, this.globalNailsVisible);
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
          scale: this.#scaleForPlacement(shape),
        });
      }
      return;
    }

    const nearest = this.#findInstanceNear(hit);
    this.#selectInstance(nearest ? nearest.id : null);
    this.dragState = nearest ? { id: nearest.id } : null;
  };

  #handlePointerMove = (event) => {
    const hit = this.#raycastToBoard(event.clientX, event.clientY);
    if (!this.dragState) {
      this.lastHit = hit;
      this.#updateGhost(hit);
      return;
    }
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
    const position = defaultCameraPosition(this.boardWidth, this.boardDepth, CAMERA_FOV);
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
