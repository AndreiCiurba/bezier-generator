import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Grid } from '../core/Grid.js';
import { DeformableGrid, DEFAULT_PIN_RADIUS, DEFAULT_PIN_FALLOFF } from '../core/DeformableGrid.js';
import { DesignModel } from '../core/DesignModel.js';
import { CurveStore } from '../state/CurveStore.js';
import { SelectionStore } from '../state/SelectionStore.js';
import { StrokePalette } from '../state/StrokePalette.js';
import { PatternStore } from '../state/PatternStore.js';
import { FavoritesStore } from '../state/FavoritesStore.js';
import { Curve } from '../models/Curve.js';
import { MenuUI } from '../ui/MenuUI.js';
import { PanelGroup } from '../ui/PanelGroup.js';
import { CurvesUI } from '../ui/CurvesUI.js';
import { ColorPickerUI } from '../ui/ColorPickerUI.js';
import { ColorCountUI } from '../ui/ColorCountUI.js';
import { StrokeWeightUI } from '../ui/StrokeWeightUI.js';
import { PatternUI } from '../ui/PatternUI.js';
import { FavoritesUI } from '../ui/FavoritesUI.js';
import { DeformationUI } from '../ui/DeformationUI.js';
import { isTypingTarget } from '../ui/keyboardFocus.js';
import { BASELINE_STROKE_WEIGHT } from '../core/strokeWeight.js';
import { PatternStamper } from '../app/PatternStamper.js';
import { SceneSync, DEFAULT_BOARD_THICKNESS, DEFAULT_BOARD_COLOR } from './SceneSync.js';
import { BoardControlsUI } from './BoardControlsUI.js';
import { GridSizeUI } from './GridSizeUI.js';
import { DEFAULT_GRID_SIZE } from './gridSize.js';
import { NailHeightUI } from './NailHeightUI.js';
import { DEFAULT_NAIL_HEIGHT } from './nailHeight.js';
import { defaultCameraPosition } from './cameraFraming.js';
import { OrientationGizmo } from './OrientationGizmo.js';
import { DrawingModeCamera } from './DrawingModeCamera.js';

// Same equidistant-lattice generation as the main grid page's own Grid class
// (spacing/rotated-layout math untouched), but always square (N x N) and
// user-resizable via the "Grid Size" control - unlike the 2D grid tool's
// fixed 15x13 rectangle. The 3D page owns its own independent Grid/
// DeformableGrid instance either way (see the progress doc's "stated
// assumption": not a live mirror of whatever's open in the `/` tab).
const GRID_SPACING = 60;
function buildGridConfig(size) {
  return { layout: 'rotated', rows: size, cols: size, spacing: GRID_SPACING, rowHeight: (GRID_SPACING * Math.sqrt(3)) / 2 };
}

const CAMERA_FOV = 50;
const CAMERA_NEAR = 1;
const CAMERA_FAR = 10000;
// The board is always centered at world X/Z = 0 (see SceneSync's origin
// shift), so the orbit target never needs to move.
const ORBIT_TARGET = { x: 0, y: 0, z: 0 };
// Design-space pick tolerance for snapping a Drawing Mode click to the
// nearest nail - same value and same reasoning as App.js's own
// NEAREST_NAIL_RADIUS. World units here are numerically identical to the 2D
// page's design-space pixels (axisMapping never rescales), so the same
// constant applies unmodified.
const NEAREST_NAIL_RADIUS = 10;
// Same grab tolerance as App.js's own PIN_PICK_RADIUS - see that file for the
// "bigger than a nail's own snap radius" rationale.
const PIN_PICK_RADIUS = 15;

/**
 * The 3D visualizer's top-level app class - structurally parallel to
 * `src/app/App.js`, but drives a Three.js render loop instead of bridging
 * into p5's global-mode lifecycle (there's no external lifecycle to bridge
 * into: Three.js has no callback contract of its own, so `init()` just does
 * the whole setup directly).
 *
 * Step 2 (scene/camera/renderer/lighting/controls/resize foundation),
 * Step 3 (the board), Step 4 (the nail grid, plus the user-selectable square
 * Grid Size control), Steps 5-6 (curve/string rendering + the shared
 * curve-visibility toggle), Step 7 (camera reset + the XYZ orientation
 * legend), Steps 8-9 (Drawing Mode: locked top-down orthographic camera,
 * raycasted nail selection/curve creation, pattern stamping, camera-pose
 * save/restore), and Step 10 (Puppet Warp deformation - the exact same
 * `DeformableGrid`/`DeformationUI` the 2D page uses; pin create/drag/remove
 * piggybacks on Drawing Mode's pointer listeners, since raycasting onto the
 * board plane only happens while the locked top-down camera is active) are
 * all folded in here now - full parity with the 2D grid page's manual +
 * pattern drawing workflow, reusing its shared UI classes (`PatternUI`,
 * `FavoritesUI`, `PatternStamper`, `DeformationUI`) verbatim, the same way
 * `CurvesUI`/`ColorPickerUI`/`ColorCountUI`/`StrokeWeightUI` already are.
 *
 * Known gap, scoped out deliberately: the 2D page's continuous "armed
 * pattern follows the cursor" ghost preview and saved-pattern list-row hover
 * preview are p5-canvas-drawing features (`CanvasView.drawArmedPatternPreview`
 * etc.) with no 3D equivalent built yet - clicking to stamp still works, you
 * just don't see a preview trailing the cursor first. A `mousemove` shim
 * (`#initMouseTracking`) keeps `PatternUI`'s shared list-hover-preview code
 * (which reads bare `mouseX`/`mouseY`, a p5-global assumption) from throwing
 * on this p5-less page, without needing to touch that shared class.
 */
export class ThreeApp {
  constructor() {
    this.canvas = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
    this.gizmo = null;
    this.drawingModeCamera = new DrawingModeCamera();
    // Which camera actually gets rendered each frame - the perspective
    // OrbitControls camera during normal inspection, or the locked top-down
    // `drawingModeCamera.camera` while Drawing Mode is active.
    this.activeCamera = null;
    this.isDrawingMode = false;
    // { position, target } snapshot of the perspective camera/controls,
    // taken on entering Drawing Mode and restored on leaving it, so the
    // user never loses their previous 3D viewpoint (epic's own requirement).
    this.savedCameraState = null;
    // Own, independent instances - not a live mirror of the `/` grid page's
    // own Grid/DeformableGrid (see the progress doc's stated assumption).
    // Wrapping in DeformableGrid now, even with zero pins and no deformation
    // UI yet (that's Slice 7), means nails already read through its *current*
    // (possibly deformed) positions - so wiring up real deformation later
    // needs no change here, just a UI that mutates this same instance.
    this.grid = new Grid(buildGridConfig(DEFAULT_GRID_SIZE));
    this.deformation = new DeformableGrid(this.grid);
    // Own, independent CurveStore/StrokePalette/SelectionStore/PatternStore/
    // FavoritesStore too (see the same "not a live mirror" note above).
    // DesignModel is the shared read-through boundary SceneSync (3D) and, on
    // the 2D page, App.js's draw/export loops both consume - one source of
    // truth for curve ordering/visibility.
    this.curves = new CurveStore();
    this.palette = new StrokePalette();
    this.selection = new SelectionStore();
    this.patterns = new PatternStore();
    this.favorites = new FavoritesStore();
    this.strokeWeight = BASELINE_STROKE_WEIGHT;
    // { pin } while a Ctrl-grabbed deformation pin is actively being dragged
    // in Drawing Mode - same shape as App.js's own `this.pinDrag`.
    this.pinDrag = null;
    // Momentary pattern-flip state: true only while V/H is physically held
    // down (see #initFlipKeys), not a toggle - same as App.js.
    this.flipVertical = false;
    this.flipHorizontal = false;
    this.design = new DesignModel(this.deformation, this.curves);
    this.sceneSync = null;
    this.submenuGroup = new PanelGroup();
    // Duck-typed "viewport" for PatternStamper - it only ever calls
    // `.toWorld(screenX, screenY)` (2D's Viewport does this via pan/zoom
    // math; here it's a raycast against the Drawing Mode camera instead).
    // PatternStamper itself needs zero changes to accept this, the same way
    // it already accepted DeformableGrid in place of a plain Grid.
    this.viewportAdapter = { toWorld: (x, y) => this.#raycastClientPointToDesignPosition(x, y) };
    this.stamper = new PatternStamper(this.deformation, this.viewportAdapter, this.curves, this.patterns);
  }

  init() {
    this.canvas = document.getElementById('three-canvas');
    this.#createScene();
    // sceneSync (and its board dimensions) has to exist before the camera -
    // the initial camera position is framed against the *actual* default
    // board footprint, not a guessed constant (see cameraFraming.js).
    this.sceneSync = new SceneSync(this.scene, this.grid, this.deformation, this.design);
    this.#createCamera();
    this.activeCamera = this.camera;
    this.#createRenderer();
    this.#createControls();
    this.#createLighting();
    this.gizmo = new OrientationGizmo();

    this.#initMenu();
    this.#initGridSizeControls();
    this.#initBoardControls();
    this.#initNailHeightControls();
    this.#initDeformationControls();
    this.#initCurvesUI();
    this.#initCameraReset();
    this.#initColorControls();
    this.#initStrokeWeightControls();
    this.#initFavoritesUI();
    this.#initPatternsUI();
    this.#initFlipKeys();
    this.#initMouseTracking();
    this.#initDrawingMode();

    window.addEventListener('resize', this.#handleResize);
    this.#handleResize();

    this.#animate();
  }

  #initMenu() {
    new MenuUI(document.getElementById('burger'), document.getElementById('ui'), document.getElementById('closeUiBtn')).init();
  }

  #initGridSizeControls() {
    new GridSizeUI(
      {
        panelEl: document.getElementById('gridSizeSubmenu'),
        openBtn: document.getElementById('openGridSizeBtn'),
        closeBtn: document.getElementById('closeGridSizeSubmenuBtn'),
        presetSelect: document.getElementById('gridSizePreset'),
        customInput: document.getElementById('gridSizeCustomInput'),
        applyBtn: document.getElementById('applyGridSizeBtn'),
      },
      this.submenuGroup,
      DEFAULT_GRID_SIZE,
      this.#handleGridSizeChange
    ).init();
  }

  #initBoardControls() {
    new BoardControlsUI(
      {
        thicknessInput: document.getElementById('boardThicknessInput'),
        applyThicknessBtn: document.getElementById('applyBoardThicknessBtn'),
        colorInput: document.getElementById('boardColorInput'),
      },
      { thickness: DEFAULT_BOARD_THICKNESS, color: DEFAULT_BOARD_COLOR },
      (thickness) => this.sceneSync.setBoardThickness(thickness),
      (color) => this.sceneSync.setBoardColor(color)
    ).init();
  }

  #initNailHeightControls() {
    new NailHeightUI(
      {
        input: document.getElementById('nailHeightInput'),
        applyBtn: document.getElementById('applyNailHeightBtn'),
      },
      DEFAULT_NAIL_HEIGHT,
      (height) => this.sceneSync.setNailHeight(height)
    ).init();
  }

  /**
   * "Deform Grid" submenu (Puppet Warp) - the exact shared `DeformationUI`
   * the 2D grid page uses, wired against this page's own `DeformableGrid`.
   * Pin creation/drag/removal itself (Ctrl/Alt+Click) is handled in
   * `#handleDeformationClick`, reached only through Drawing Mode's pointer
   * listeners (see `#initDrawingMode`) - raycasting onto the board/nail plane
   * is only meaningful while the locked top-down camera is active, so pin
   * editing shares that same gate rather than growing a second, perspective-
   * camera-aware raycast path.
   */
  #initDeformationControls() {
    this.deformationUI = new DeformationUI(
      {
        panelEl: document.getElementById('deformationSubmenu'),
        openBtn: document.getElementById('openDeformationBtn'),
        closeBtn: document.getElementById('closeDeformationSubmenuBtn'),
        defaultRadiusInput: document.getElementById('deformationDefaultRadiusInput'),
        defaultFalloffInput: document.getElementById('deformationDefaultFalloffInput'),
        applyDefaultsBtn: document.getElementById('applyDeformationDefaultsBtn'),
        selectedRadiusInput: document.getElementById('deformationSelectedRadiusInput'),
        selectedFalloffInput: document.getElementById('deformationSelectedFalloffInput'),
        applySelectedBtn: document.getElementById('applyDeformationSelectedBtn'),
        removePinBtn: document.getElementById('removeDeformationPinBtn'),
        resetBtn: document.getElementById('resetDeformationBtn'),
        pinCountEl: document.getElementById('deformationPinCount'),
      },
      this.submenuGroup,
      { radius: DEFAULT_PIN_RADIUS, falloff: DEFAULT_PIN_FALLOFF },
      this.#handleRemoveDeformationPin,
      this.#handleResetDeformation,
      this.#handleSelectedPinChanged
    );
    this.deformationUI.init();
  }

  #handleRemoveDeformationPin = (pin) => {
    this.deformation.removePin(pin);
    this.deformationUI.refreshPinCount(this.deformation.pins.length);
    this.sceneSync.syncNailPositions();
    this.#refreshDeformationPins();
  };

  #handleResetDeformation = () => {
    this.deformation.reset();
    this.deformationUI.refreshPinCount(0);
    this.sceneSync.syncNailPositions();
    this.#refreshDeformationPins();
  };

  /** The selected pin's radius/falloff were edited directly in the panel, bypassing `DeformableGrid`'s own mutators - force a recompute, same as App.js. */
  #handleSelectedPinChanged = () => {
    this.deformation.invalidate();
    this.sceneSync.syncNailPositions();
    this.#refreshDeformationPins();
  };

  /** Re-reads the current pin set into `SceneSync`'s pin markers - called after any create/move/remove/select. */
  #refreshDeformationPins() {
    this.sceneSync.setDeformationPins(this.deformation.pins, this.deformationUI.selectedPin);
  }

  /** "Curves" submenu - every committed curve, in store order, with a show/hide checkbox each (the same `CurvesUI` the 2D grid page uses, reading/writing this page's own `CurveStore`). */
  #initCurvesUI() {
    new CurvesUI(
      {
        panelEl: document.getElementById('curvesSubmenu'),
        openBtn: document.getElementById('openCurvesBtn'),
        closeBtn: document.getElementById('closeCurvesSubmenuBtn'),
        listEl: document.getElementById('curvesList'),
      },
      this.curves,
      this.submenuGroup
    ).init();
  }

  /** Colors: the swatch pickers (left-click = change, right-click = enable/disable a layer) plus the "how many colors" field - identical shared classes to both p5 pages, just wired against this page's own `StrokePalette`. */
  #initColorControls() {
    this.colorPickerUI = new ColorPickerUI(document.getElementById('colorPickerContainer'), this.palette);
    this.colorPickerUI.init();

    this.colorCountUI = new ColorCountUI(
      { input: document.getElementById('colorCountInput'), applyBtn: document.getElementById('applyColorCountBtn') },
      this.palette.size,
      this.#handleColorCountChange
    );
    this.colorCountUI.init();
  }

  /**
   * Same "clears the current design" convention as a Grid Size change (and
   * as App.js's own color-count handler, which this mirrors exactly,
   * including clearing any armed pattern) - a curve keeps its own
   * `colors.length` forever once committed, but a stale in-progress
   * selection/mismatched palette size is more confusing left around than
   * cleared.
   */
  #handleColorCountChange = (count) => {
    this.patterns.clearSelection();
    this.patternUI.resetSelectionVisual();
    this.selection.reset();
    this.sceneSync.clearSelectionGuide();
    this.sceneSync.clearLivePreview();
    this.curves.clear();
    this.palette.resize(count);
    this.colorPickerUI.rebuild();
  };

  #initStrokeWeightControls() {
    new StrokeWeightUI(
      { input: document.getElementById('strokeWeightInput'), applyBtn: document.getElementById('applyStrokeWeightBtn') },
      this.strokeWeight,
      (weight) => {
        this.strokeWeight = weight;
      }
    ).init();
  }

  /** "Colors" (favorite bundle save/export/import/apply) submenu - the exact shared `FavoritesUI` both p5 pages use. Must run after `#initColorControls` (needs `this.colorPickerUI`/`this.colorCountUI` already built). */
  #initFavoritesUI() {
    new FavoritesUI(
      {
        panelEl: document.getElementById('colorFavoritesSubmenu'),
        openBtn: document.getElementById('openFavoritesBtn'),
        closeBtn: document.getElementById('closeColorSubmenuBtn'),
        saveBtn: document.getElementById('saveCurrentColorBtn'),
        exportBtn: document.getElementById('exportColorsBtn'),
        importBtn: document.getElementById('importColorsBtn'),
        importInput: document.getElementById('importColorsInput'),
        bundlesContainer: document.getElementById('favoriteBundlesContainer'),
      },
      this.favorites,
      this.palette,
      this.colorPickerUI,
      this.submenuGroup,
      (newSize) => this.colorCountUI.setCount(newSize)
    ).init();
  }

  /** "Patterns" submenu (save current selection, saved-pattern list, Manual/Auto placement, export/import) - the exact shared `PatternUI`/`PatternStamper` the 2D grid page uses. */
  #initPatternsUI() {
    this.patternUI = new PatternUI(
      {
        panelEl: document.getElementById('patternSubmenu'),
        openBtn: document.getElementById('openPatternBtn'),
        closeBtn: document.getElementById('closePatternSubmenuBtn'),
        exportBtn: document.getElementById('exportPatternBtn'),
        importBtn: document.getElementById('importPatternBtn'),
        importInput: document.getElementById('importPatternInput'),
        saveBtn: document.getElementById('saveCurrentPatternBtn'),
        nameInput: document.getElementById('patternNameInput'),
        listEl: document.getElementById('savedPatternsList'),
        toggleModeBtn: document.getElementById('toggleBtn'),
      },
      this.patterns,
      this.selection,
      this.palette,
      this.stamper,
      this.submenuGroup,
      undefined, // onPatternSaved - freestyle-only origin-tagging feature, unused here (matches App.js)
      () => this.strokeWeight
    );
    this.patternUI.init();
  }

  /** Held-key pattern flip (V/H), guarded against firing while typing and against a stuck-flipped state if focus leaves the page mid-hold - identical wiring to App.js. */
  #initFlipKeys() {
    window.addEventListener('keydown', (e) => {
      if (isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === 'v') this.flipVertical = true;
      if (key === 'h') this.flipHorizontal = true;
    });
    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (key === 'v') this.flipVertical = false;
      if (key === 'h') this.flipHorizontal = false;
    });
    window.addEventListener('blur', () => {
      this.flipVertical = false;
      this.flipHorizontal = false;
    });
  }

  /**
   * `PatternUI`'s saved-pattern list-row hover preview reads the bare p5
   * globals `mouseX`/`mouseY` (see `PatternUI.js`'s `mousemove` listener) -
   * this page has no p5 runtime providing them, so a plain `mousemove` shim
   * keeps `window.mouseX`/`window.mouseY` populated rather than modifying
   * that shared class just for this page. (The preview itself is only ever
   * *read* via `patterns.preview`/`CanvasView` on the 2D pages - this page
   * doesn't render it, per the class doc's noted scope gap - this shim only
   * exists to stop the shared code from throwing.)
   */
  #initMouseTracking() {
    window.addEventListener('mousemove', (e) => {
      window.mouseX = e.clientX;
      window.mouseY = e.clientY;
    });
  }

  /**
   * Wires the Drawing Mode toggle plus the manual curve-building buttons
   * (Reset/Clear All/Undo/Undo Line) - same ids/labels/semantics as the 2D
   * grid page's own buttons (`App.js`), for a consistent vocabulary across
   * pages, even though nothing here is a literally shared UI class (App.js
   * wires these directly too, not through one).
   */
  #initDrawingMode() {
    document.getElementById('drawingModeToggle').addEventListener('change', (event) => {
      if (event.target.checked) this.#enterDrawingMode();
      else this.#exitDrawingMode();
    });
    document.getElementById('resetBtn').addEventListener('click', this.#handleCommitCurve);
    document.getElementById('clearAllBtn').addEventListener('click', this.#handleClearAll);
    document.getElementById('undoBtn').addEventListener('click', this.#handleUndo);
    document.getElementById('undoLineBtn').addEventListener('click', this.#handleUndoLine);
  }

  /** Commits the in-progress selection into a new curve - mirrors `App.js#handleReset` exactly (same misleadingly-named "Reset" button, same behavior: clear any armed pattern, commit-if-ready, then clear the selection either way). New curves appear immediately via `CurveStore#add`'s `onChange` notification, which `SceneSync` is already subscribed to (Slice 4) - no extra wiring needed here. */
  #handleCommitCurve = () => {
    this.patterns.clearSelection();
    this.patternUI.resetSelectionVisual();
    if (this.selection.isReadyForCurve()) {
      this.curves.add(new Curve(this.selection.points.map((p) => p.copy()), this.palette.snapshot(), null, this.strokeWeight));
    }
    this.selection.reset();
    this.sceneSync.clearSelectionGuide();
    this.sceneSync.clearLivePreview();
  };

  #handleClearAll = () => {
    this.selection.reset();
    this.curves.clear();
    this.sceneSync.clearSelectionGuide();
    this.sceneSync.clearLivePreview();
  };

  /** Undoes the whole current figure - the last *committed* curve, plus whatever's still in progress. Mirrors `App.js#handleUndo`. */
  #handleUndo = () => {
    if (this.curves.count > 0) this.curves.undo();
    this.selection.reset();
    this.sceneSync.clearSelectionGuide();
    this.sceneSync.clearLivePreview();
  };

  /** Undoes just the most recently placed point of the figure being built. Mirrors `App.js#handleUndoLine`. */
  #handleUndoLine = () => {
    this.selection.undoLast();
    this.sceneSync.setSelectionGuide(this.selection.points);
    this.sceneSync.setLivePreview(this.selection.points, this.palette.getAll());
  };

  /**
   * Enters Drawing Mode (epic Steps 8-9): saves the current perspective
   * camera pose, disables `OrbitControls` entirely, switches the actively
   * rendered/raycasted camera to the locked top-down orthographic one, and
   * starts listening for canvas pointer events (down/move/up, not just
   * `click` - Deformation Mode's Ctrl+Drag needs to track motion between
   * press and release, the same way App.js's `mouseDragged`/`mouseReleased`
   * do on the 2D page).
   */
  #enterDrawingMode() {
    this.isDrawingMode = true;
    this.savedCameraState = { position: this.camera.position.clone(), target: this.controls.target.clone() };
    this.controls.enabled = false;
    document.getElementById('resetCameraBtn').disabled = true;
    this.#updateDrawingCameraFrustum();
    this.activeCamera = this.drawingModeCamera.camera;
    this.canvas.addEventListener('pointerdown', this.#handleCanvasPointerDown);
    this.canvas.addEventListener('pointermove', this.#handleCanvasPointerMove);
    window.addEventListener('pointerup', this.#handleCanvasPointerUp);
  }

  /** Leaves Drawing Mode: restores the perspective camera to exactly where the user left it, and re-enables normal orbit/pan/zoom inspection. */
  #exitDrawingMode() {
    this.isDrawingMode = false;
    this.canvas.removeEventListener('pointerdown', this.#handleCanvasPointerDown);
    this.canvas.removeEventListener('pointermove', this.#handleCanvasPointerMove);
    window.removeEventListener('pointerup', this.#handleCanvasPointerUp);
    this.pinDrag = null;
    this.camera.position.copy(this.savedCameraState.position);
    this.controls.target.copy(this.savedCameraState.target);
    this.savedCameraState = null;
    this.controls.enabled = true;
    this.controls.update();
    document.getElementById('resetCameraBtn').disabled = false;
    this.activeCamera = this.camera;
  }

  /**
   * Converts a client-space (viewport pixel) point into a 2D design-space
   * point, via the locked orthographic camera's raycast onto the board
   * plane - the 3D-native equivalent of `Viewport#toWorld` on the 2D page.
   * Shared by manual point placement and (via `this.viewportAdapter`)
   * `PatternStamper`.
   * @param {number} clientX
   * @param {number} clientY
   * @returns {{x:number,y:number} | null}
   */
  #raycastClientPointToDesignPosition(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);
    const hit = this.drawingModeCamera.raycastToBoardPlane(ndcX, ndcY);
    return hit ? this.sceneSync.toDesignPosition(hit) : null;
  }

  /**
   * Drawing Mode's single pointer-down entry point - the *exact* branch
   * `App.js#mousePressed` takes on the 2D page: Deformation Mode (if active)
   * gets first refusal at the click (pin create/select/remove), otherwise it
   * falls through to normal curve building/pattern stamping.
   * @param {PointerEvent} event
   */
  #handleCanvasPointerDown = (event) => {
    if (this.deformationUI.isActive) {
      this.#handleDeformationClick(event);
      return;
    }
    this.#handleDrawingClick(event);
  };

  /** While a pin is Ctrl-grabbed (see `#handleDeformationClick`), drags it live - mirrors `App.js#mouseDragged`'s pin-drag branch. A no-op the rest of the time (most pointer moves in Drawing Mode aren't dragging anything). */
  #handleCanvasPointerMove = (event) => {
    if (!this.pinDrag) return;
    const worldPos = this.#raycastClientPointToDesignPosition(event.clientX, event.clientY);
    if (!worldPos) return;
    this.deformation.movePin(this.pinDrag.pin, worldPos);
    this.sceneSync.syncNailPositions();
    this.#refreshDeformationPins();
  };

  /** Releases whatever pin was being dragged, if any - mirrors `App.js#mouseReleased`. */
  #handleCanvasPointerUp = () => {
    this.pinDrag = null;
  };

  /**
   * Handles a pointer-down while Deformation Mode is active - the *exact*
   * branch `App.js#handleDeformationClick` takes on the 2D page: Ctrl+Click a
   * pin drags it (or creates one, anchored on the nearest *base* nail, if
   * none was hit), Alt+Click a pin removes it, and a plain click on a pin
   * just selects it - not a drawing action either way.
   * @param {PointerEvent} event
   */
  #handleDeformationClick(event) {
    const worldPos = this.#raycastClientPointToDesignPosition(event.clientX, event.clientY);
    if (!worldPos) return;

    if (event.altKey) {
      const pin = this.deformation.findNearestPin(worldPos, PIN_PICK_RADIUS);
      if (!pin) return;
      this.deformation.removePin(pin);
      this.deformationUI.refreshPinCount(this.deformation.pins.length);
      if (this.deformationUI.selectedPin === pin) this.deformationUI.setSelectedPin(null);
      this.sceneSync.syncNailPositions();
      this.#refreshDeformationPins();
      return;
    }

    if (event.ctrlKey) {
      let pin = this.deformation.findNearestPin(worldPos, PIN_PICK_RADIUS);
      if (!pin) {
        const nail = this.deformation.findNearestBaseNail(worldPos, NEAREST_NAIL_RADIUS);
        if (!nail) return;
        pin = this.deformation.addPin({
          referencePosition: nail,
          radius: this.deformationUI.defaultRadius,
          falloff: this.deformationUI.defaultFalloff,
        });
        this.deformationUI.refreshPinCount(this.deformation.pins.length);
        this.sceneSync.syncNailPositions();
      }
      this.pinDrag = { pin };
      this.deformationUI.setSelectedPin(pin);
      this.#refreshDeformationPins();
      return;
    }

    this.deformationUI.setSelectedPin(this.deformation.findNearestPin(worldPos, PIN_PICK_RADIUS));
    this.#refreshDeformationPins();
  }

  /**
   * A Drawing Mode point placement: stamps the armed pattern if one is
   * selected, otherwise extends the manual selection - the *exact* branch
   * `App.js#placeAtScreenPoint` takes on the 2D page, reusing
   * `PatternStamper`/`DeformableGrid#findNearestPoint`/`SelectionStore#add`
   * unmodified rather than duplicating any of that logic.
   * @param {PointerEvent} event
   */
  #handleDrawingClick = (event) => {
    if (this.patterns.isInUse) {
      this.stamper.stampAtScreenPoint(
        { x: event.clientX, y: event.clientY },
        { horizontal: this.flipHorizontal, vertical: this.flipVertical },
        this.strokeWeight
      );
      return;
    }

    const worldPos = this.#raycastClientPointToDesignPosition(event.clientX, event.clientY);
    if (!worldPos) return;
    const nearest = this.deformation.findNearestPoint(worldPos, NEAREST_NAIL_RADIUS);
    if (!nearest) return;

    this.selection.add(nearest.copy());
    this.sceneSync.setSelectionGuide(this.selection.points);
    this.sceneSync.setLivePreview(this.selection.points, this.palette.getAll());
  };

  /** Fits the Drawing Mode camera's frustum to the board's *current* size/the *current* viewport - called on every resize and every Grid Size change, so it's always correct the instant Drawing Mode is entered. */
  #updateDrawingCameraFrustum() {
    this.drawingModeCamera.updateFrustum(this.sceneSync.boardWidth, this.sceneSync.boardDepth, window.innerWidth, window.innerHeight);
  }

  /**
   * Rebuilds the grid/deformation from scratch at a new square size N and
   * hands both to `SceneSync` - board footprint and nail count both change,
   * so both get fully rebuilt (see `SceneSync#setGrid`). Clears the current
   * curves/selection/armed-pattern first (matches the 2D app's existing
   * "structural change clears the current design" convention) - existing
   * curve points were snapshotted against the old grid and wouldn't line up
   * with the new one.
   * @param {number} size
   */
  #handleGridSizeChange = (size) => {
    this.patterns.clearSelection();
    this.patternUI.resetSelectionVisual();
    this.selection.reset();
    this.sceneSync.clearSelectionGuide();
    this.sceneSync.clearLivePreview();
    this.curves.clear();
    this.grid = new Grid(buildGridConfig(size));
    this.deformation = new DeformableGrid(this.grid);
    this.sceneSync.setGrid(this.grid, this.deformation);
    // `this.stamper` was constructed once against the *original* deformation
    // instance - without repointing it here, Auto/manual pattern stamping
    // would keep anchoring/snapping against the stale, now-replaced grid
    // forever (the actual bug behind "Auto spreads across the original grid,
    // not the current size").
    this.stamper.setGrid(this.deformation);
    this.#updateDrawingCameraFrustum();
    // The new DeformableGrid starts with zero pins - reflect that in the
    // Deformation submenu/pin markers rather than leaving stale state from
    // the old (now-replaced) grid around.
    this.pinDrag = null;
    this.deformationUI.setSelectedPin(null);
    this.deformationUI.refreshPinCount(0);
    this.#refreshDeformationPins();
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

  /** The board-framed "useful default" view (see cameraFraming.js) - used both for the initial camera position and for the "Reset Camera" control, so both always agree. */
  #applyDefaultCameraView() {
    const position = defaultCameraPosition(this.sceneSync.boardWidth, this.sceneSync.boardDepth, CAMERA_FOV);
    this.camera.position.set(position.x, position.y, position.z);
    this.camera.lookAt(ORBIT_TARGET.x, ORBIT_TARGET.y, ORBIT_TARGET.z);
    if (this.controls) {
      this.controls.target.set(ORBIT_TARGET.x, ORBIT_TARGET.y, ORBIT_TARGET.z);
      this.controls.update();
    }
  }

  #initCameraReset() {
    document.getElementById('resetCameraBtn').addEventListener('click', () => this.#applyDefaultCameraView());
  }

  #createRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  #createControls() {
    // Three's own OrbitControls, not custom camera math (the epic's own
    // instruction). Its defaults already match the epic's recommended
    // interaction verbatim: left-drag orbits, right-drag pans, wheel zooms.
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
    // Fat-line (LineSegments2) width is defined in screen-space pixels, so
    // every curve's material needs the current viewport size too.
    this.sceneSync.setViewportSize(width, height);
    this.#updateDrawingCameraFrustum();
  };

  #animate = () => {
    requestAnimationFrame(this.#animate);
    this.controls.update(); // required each frame while enableDamping is on (harmless while disabled - no user input to apply either way)
    this.renderer.render(this.scene, this.activeCamera);
    this.gizmo.render(this.renderer, this.activeCamera); // fixed bottom-right XYZ legend, drawn last so it overlays the main scene
  };
}
