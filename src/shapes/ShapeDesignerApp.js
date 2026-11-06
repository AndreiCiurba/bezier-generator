import { Viewport } from '../core/Viewport.js';
import { StringArtRenderer } from '../core/StringArtRenderer.js';
import { StrokePalette } from '../state/StrokePalette.js';
import { ShapeEditorState } from '../state/ShapeEditorState.js';
import { ShapeLibraryStore } from '../state/ShapeLibraryStore.js';
import { FreeformShape } from '../models/FreeformShape.js';
import { resampleClosedOutline, MIN_CLOSED_ANCHORS } from '../core/bezierOutline.js';
import { circleAnchors, ovalAnchors, triangleAnchors, rectAnchors } from '../core/shapePresets.js';
import { ShapeCanvasView } from './ShapeCanvasView.js';
import { ShapeLibraryUI } from '../ui/ShapeLibraryUI.js';
import { MenuUI } from '../ui/MenuUI.js';
import { PanelGroup } from '../ui/PanelGroup.js';
import { ColorPickerUI } from '../ui/ColorPickerUI.js';
import { PickerModeUI } from '../ui/PickerModeUI.js';
import { ColorCountUI } from '../ui/ColorCountUI.js';
import { StrokeWeightUI } from '../ui/StrokeWeightUI.js';
import { touchesMenus } from '../ui/menuHitTest.js';
import { isTypingTarget } from '../ui/keyboardFocus.js';
import { BASELINE_STROKE_WEIGHT } from '../core/strokeWeight.js';
import { generateId } from '../utils/id.js';
import { saveToStorage, loadFromStorage, clearFromStorage } from '../io/BrowserStorage.js';
import { SHAPE_LIBRARY_STORAGE_KEY, SHAPE_DRAFT_STORAGE_KEY } from '../io/storageKeys.js';

// Fixed, centered canvas (no grid to size around) - same idea as freestyle's
// own fixed-size board, just plain pixels since there's no physical-unit
// planning concern on this page.
const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 650;

const DEFAULT_NAIL_COUNT = 24;
const DEFAULT_LEAP = 3;
const MIN_NAIL_COUNT = 3;
// Scaled 10x (was 120) - at the app's lowered 0.01 stroke-weight floor (see
// strokeWeightSetting.js), shapes need real world-space room for a thin
// string to read as thin rather than crowded. Safe to take the full 10x here
// (unlike the Grid page's own 3x - see App.js's own doc) since this page's
// canvas is a fixed-size pan/zoom viewport, not sized to its content - a
// bigger preset just means zooming out a bit to see all of it, no canvas
// memory cost either way.
const PRESET_RADIUS = 1200;

// World-space pick radii (raw, not zoom-adjusted - same convention
// NEAREST_NAIL_RADIUS/PIN_PICK_RADIUS already use in App.js), scaled 10x
// alongside PRESET_RADIUS for the same reason.
const ANCHOR_PICK_RADIUS = 100;
const HANDLE_PICK_RADIUS = 80;
const CLOSE_PICK_RADIUS = 120;

// Freehand drawing only captures a new point once the cursor has moved this
// far (world units) since the last one - otherwise a slow trace would pile
// up thousands of nearly-identical points. Small enough to trace a tight
// curve faithfully, large enough to keep the resulting anchor count sane.
// Scaled 10x alongside the constants above, for the same reason.
const FREEHAND_MIN_POINT_SPACING = 60;

/**
 * The Shape Designer page, wired together - a Paint-style editor for closed
 * bezier shapes (see `core/bezierOutline.js`), each configured with its own
 * nail count/leap/colors/height as it's drawn ("configure-as-you-draw"),
 * then committed into a `ShapeLibraryStore` for later use on the Arrange
 * Board page. No grid, no pattern stamping, no deformation - just two
 * drawing tools (freehand trace, or click-to-place anchors) plus the
 * settings panel, modeled on `App.js`'s own structure.
 *
 * Freehand (the default - `this.drawMode`) is the actual "draw it like
 * Paint" tool: press and drag traces a closed outline directly, captured as
 * one anchor per `FREEHAND_MIN_POINT_SPACING` of cursor movement, each with
 * no explicit handles so `autoHandles` (see `bezierOutline.js`) smooths the
 * traced path into a curve on release. Anchors mode is the precise pen tool
 * from the first version of this page - click to place each anchor, drag to
 * reshape - still useful for exact polygons a freehand trace can't reliably
 * reproduce. Either tool can still grab/drag an existing anchor or handle
 * first (checked before either tool's own "start something new" behavior),
 * so a freehand trace can always be fine-tuned afterward with precise drags.
 *
 * Phase 1 of `docs/persistence-plan.md`: the committed library and the
 * in-progress draft (anchors/settings/palette - everything
 * `handleCommitShape` would otherwise need) both auto-persist to
 * `localStorage` via `io/BrowserStorage.js`, and both hydrate back on load -
 * see `#hydrateLibrary`/`#hydrateDraft`. Same-origin pages share
 * `localStorage`, so a committed shape is already available on `/arrange/`
 * without ever exporting/importing a file.
 */
export class ShapeDesignerApp {
  constructor() {
    this.canvasWidth = CANVAS_WIDTH;
    this.canvasHeight = CANVAS_HEIGHT;
    this.viewport = new Viewport({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 });

    this.palette = new StrokePalette();
    this.editor = new ShapeEditorState();
    this.library = new ShapeLibraryStore();

    // The shape-in-progress's own weave settings - plain fields (not a
    // dedicated state class), mirroring how App.js keeps `strokeWeight` as a
    // simple field rather than a store, since only this page's own settings
    // panel ever reads/writes them.
    this.nailCount = DEFAULT_NAIL_COUNT;
    this.leap = DEFAULT_LEAP;
    this.useGlobalHeight = true;
    this.heightOverride = null;
    // Unlike height (which has no effect on this page's flat 2D preview),
    // stroke weight always needs a live value to draw the preview with, so
    // this field stays active/meaningful regardless of `useGlobalWeight` -
    // that flag only decides whether the *committed* shape stores this value
    // as an explicit override or defers to the Arrange board's own global
    // default (`weight: null` - see `FreeformShape`'s own doc).
    this.strokeWeight = BASELINE_STROKE_WEIGHT;
    this.useGlobalWeight = true;

    // { type: 'anchor', index } | { type: 'handle', index, which } | null
    this.activeDrag = null;

    this.isPanning = false;
    this.panStart = null;

    // 'freehand' | 'anchor' - see this class's own doc.
    this.drawMode = 'freehand';
    this.isCapturingFreehand = false;
    this.freehandPoints = [];
  }

  setup = () => {
    // Must run before any UI class below is constructed - they all read
    // their *initial* state straight off this.library/this.palette/
    // this.nailCount/etc. at construction time.
    this.#hydrateLibrary();
    this.#hydrateDraft();

    // From here on, any change to the committed library or the in-progress
    // draft re-persists automatically - see #saveDraft's own doc for why
    // hooking these two onChange subscriptions covers every anchor/handle
    // drag and every palette edit without a separate call at each site.
    this.library.onChange(() => {
      saveToStorage(SHAPE_LIBRARY_STORAGE_KEY, this.library.shapes.map((s) => s.toJSON()));
    });
    this.editor.onChange(() => this.#saveDraft());
    this.palette.onChange(() => this.#saveDraft());

    const colorPickerContainer = document.getElementById('colorPickerContainer');
    this.colorPickerUI = new ColorPickerUI(colorPickerContainer, this.palette);
    this.colorPickerUI.init();

    new PickerModeUI(
      { defaultBtn: document.getElementById('pickerModeDefaultBtn'), customBtn: document.getElementById('pickerModeCustomBtn') },
      this.colorPickerUI
    ).init();

    const submenuGroup = new PanelGroup();

    this.libraryUI = new ShapeLibraryUI(
      {
        panelEl: document.getElementById('librarySubmenu'),
        openBtn: document.getElementById('openLibraryBtn'),
        closeBtn: document.getElementById('closeLibrarySubmenuBtn'),
        listEl: document.getElementById('savedShapesList'),
        exportBtn: document.getElementById('exportShapesBtn'),
        importBtn: document.getElementById('importShapesBtn'),
        importInput: document.getElementById('importShapesInput'),
      },
      this.library,
      submenuGroup
    );
    this.libraryUI.init();

    this.colorCountUI = new ColorCountUI(
      { input: document.getElementById('colorCountInput'), applyBtn: document.getElementById('applyColorCountBtn') },
      this.palette.size,
      (count) => {
        this.palette.resize(count);
        this.colorPickerUI.rebuild();
      }
    );
    this.colorCountUI.init();

    new MenuUI(document.getElementById('burger'), document.getElementById('ui'), document.getElementById('closeUiBtn')).init();

    this.#wireShapeSettings();
    this.#wirePresetButtons();
    this.#wireEditingButtons();
    this.#wireDrawModeToggle();
    this.#wirePersistenceControls();
    this.#createCanvas();

    window.addEventListener('keydown', (e) => {
      if (isTypingTarget(e.target)) return;
      if (e.key === 'Escape') {
        this.handleResetShape();
      } else if (e.key === 'Enter' && !this.editor.closed && this.editor.canClose()) {
        this.editor.close();
      } else if ((e.key === 'Backspace' || e.key === 'Delete') && !this.editor.closed) {
        this.editor.undoLastAnchor();
      }
    });
  };

  draw = () => {
    background(12);
    this.viewport.applyTransform();

    ShapeCanvasView.withCommittedShapeAlpha(() => {
      for (const shape of this.library.shapes) {
        StringArtRenderer.drawClosedWeave(shape.resampledOutline(), 0, shape.leap, shape.colors, BASELINE_STROKE_WEIGHT);
      }
    });

    const anchors = this.editor.anchors;
    if (anchors.length > 0) {
      ShapeCanvasView.drawOutlineGuide(anchors);

      if (this.editor.closed) {
        const nails = resampleClosedOutline(anchors, this.nailCount);
        StringArtRenderer.drawClosedWeave(nails, 0, this.leap, this.palette.getAll(), this.strokeWeight);
      }

      ShapeCanvasView.drawAnchors(anchors, this.editor.selectedIndex, this.editor.closed);
      ShapeCanvasView.drawSelectedHandles(anchors, this.editor.selectedIndex);
    }

    if (this.isCapturingFreehand) {
      ShapeCanvasView.drawFreehandPath(this.freehandPoints);
    }
  };

  mousePressed = () => {
    if (touchesMenus(winMouseX, winMouseY)) return;

    if (mouseButton === CENTER) {
      this.isPanning = true;
      this.panStart = { x: mouseX, y: mouseY };
      return;
    }

    const worldPos = this.viewport.toWorld(mouseX, mouseY);

    // Grabbing an existing handle/anchor always takes priority over either
    // tool's own "start something new" behavior, in both draw modes - so a
    // freehand trace (or a preset) can still be fine-tuned by precise drags
    // afterward.
    if (this.editor.closed) {
      const handle = this.#findHandleNear(worldPos);
      if (handle) {
        this.activeDrag = { type: 'handle', index: handle.index, which: handle.which };
        return;
      }
      const anchorIndex = this.#findAnchorNear(worldPos);
      if (anchorIndex !== -1) {
        this.editor.selectAnchor(anchorIndex);
        this.activeDrag = { type: 'anchor', index: anchorIndex };
        return;
      }
    }

    if (this.drawMode === 'freehand') {
      // Starting a new trace always replaces whatever's currently in
      // progress - same "just draw it" convention as Paint, no separate
      // reset step needed first.
      this.editor.reset();
      this.isCapturingFreehand = true;
      this.freehandPoints = [worldPos];
      return;
    }

    if (!this.editor.closed) {
      if (this.editor.canClose() && this.#distanceTo(this.editor.anchors[0], worldPos) <= CLOSE_PICK_RADIUS) {
        this.editor.close();
      } else {
        this.editor.addAnchor(worldPos);
      }
      return;
    }

    this.editor.clearSelectedAnchor();
  };

  mouseDragged = () => {
    if (this.isPanning && this.panStart) {
      this.viewport.panBy(mouseX - this.panStart.x, mouseY - this.panStart.y);
      this.panStart = { x: mouseX, y: mouseY };
      return;
    }

    if (this.isCapturingFreehand) {
      const worldPos = this.viewport.toWorld(mouseX, mouseY);
      const last = this.freehandPoints[this.freehandPoints.length - 1];
      if (this.#distanceTo(last, worldPos) >= FREEHAND_MIN_POINT_SPACING) {
        this.freehandPoints.push(worldPos);
      }
      return;
    }

    if (!this.activeDrag) return;
    const worldPos = this.viewport.toWorld(mouseX, mouseY);
    if (this.activeDrag.type === 'anchor') {
      this.editor.moveAnchor(this.activeDrag.index, worldPos);
    } else {
      this.editor.moveHandle(this.activeDrag.index, this.activeDrag.which, worldPos);
    }
  };

  mouseReleased = () => {
    this.isPanning = false;
    this.activeDrag = null;

    if (this.isCapturingFreehand) {
      this.isCapturingFreehand = false;
      if (this.freehandPoints.length >= MIN_CLOSED_ANCHORS) {
        const anchors = this.freehandPoints.map((p) => ({ x: p.x, y: p.y, handleIn: null, handleOut: null }));
        this.editor.loadPreset(anchors);
      }
      this.freehandPoints = [];
    }
  };

  mouseWheel = (event) => {
    this.viewport.zoomBy(event.delta > 0 ? 0.9 : 1.1);
    return false;
  };

  /** Clears the shape currently being drawn, without touching the committed library. */
  handleResetShape = () => {
    this.editor.reset();
    this.activeDrag = null;
    this.isCapturingFreehand = false;
    this.freehandPoints = [];
  };

  handleCommitShape = () => {
    if (!this.editor.closed) {
      alert('Close the shape first - click back on its first point, or press Enter.');
      return;
    }
    const nameInput = document.getElementById('shapeNameInput');
    const name = nameInput.value.trim() || `Shape ${this.library.count + 1}`;

    const shape = new FreeformShape({
      id: generateId(),
      name,
      anchors: this.editor.anchors,
      nailCount: this.nailCount,
      leap: this.leap,
      colors: this.palette.snapshot(),
      height: this.useGlobalHeight ? null : this.heightOverride,
      weight: this.useGlobalWeight ? null : this.strokeWeight,
    });
    this.library.add(shape);
    this.editor.reset();
    nameInput.value = '';
  };

  /** Restores the committed library from `localStorage`, if anything was saved there - see this class's own doc. */
  #hydrateLibrary() {
    const raw = loadFromStorage(SHAPE_LIBRARY_STORAGE_KEY);
    if (Array.isArray(raw)) this.library.importShapes(raw, FreeformShape);
  }

  /**
   * Restores the in-progress draft (anchors/closed state, this shape's own
   * nails/leap/height/weight settings, and its palette) from `localStorage`,
   * if anything was saved there. Each field is independently validated
   * before being applied, so a partially-corrupt or hand-edited draft still
   * restores whatever of it *is* usable rather than being thrown out whole.
   */
  #hydrateDraft() {
    const draft = loadFromStorage(SHAPE_DRAFT_STORAGE_KEY);
    if (!draft) return;

    if (Number.isInteger(draft.nailCount) && draft.nailCount >= MIN_NAIL_COUNT) this.nailCount = draft.nailCount;
    if (Number.isInteger(draft.leap)) this.leap = draft.leap;
    if (typeof draft.useGlobalHeight === 'boolean') this.useGlobalHeight = draft.useGlobalHeight;
    if (draft.heightOverride === null || Number.isFinite(draft.heightOverride)) this.heightOverride = draft.heightOverride;
    if (Number.isFinite(draft.strokeWeight) && draft.strokeWeight > 0) this.strokeWeight = draft.strokeWeight;
    if (typeof draft.useGlobalWeight === 'boolean') this.useGlobalWeight = draft.useGlobalWeight;
    if (draft.drawMode === 'freehand' || draft.drawMode === 'anchor') this.drawMode = draft.drawMode;
    if (Array.isArray(draft.colors)) this.#applyPaletteColors(draft.colors);
    if (Array.isArray(draft.anchors)) this.editor.hydrate({ anchors: draft.anchors, closed: Boolean(draft.closed) });
  }

  /** Resizes/recolors `this.palette` to match a saved color snapshot - same resize-then-recolor sequence `WeaveUI#applyRecipeColors`/`FavoritesUI#applyBundle` already use. */
  #applyPaletteColors(colors) {
    if (colors.length === 0) return;
    this.palette.resize(colors.length);
    colors.forEach((c, i) => {
      this.palette.setColor(i, c.color);
      if (this.palette.getSlot(i).enabled !== Boolean(c.enabled)) this.palette.toggleEnabled(i);
    });
  }

  /**
   * Persists the in-progress draft - every field `handleCommitShape` would
   * otherwise read, so reloading mid-shape resumes exactly where you left
   * off. Subscribed to both `this.editor.onChange` and `this.palette.onChange`
   * (see `setup()`), so this fires on every anchor/handle drag frame and
   * every color edit; also called explicitly from each settings field's own
   * change handler, since those plain fields have no `onChange` of their own.
   */
  #saveDraft() {
    saveToStorage(SHAPE_DRAFT_STORAGE_KEY, {
      anchors: this.editor.anchors,
      closed: this.editor.closed,
      nailCount: this.nailCount,
      leap: this.leap,
      useGlobalHeight: this.useGlobalHeight,
      heightOverride: this.heightOverride,
      strokeWeight: this.strokeWeight,
      useGlobalWeight: this.useGlobalWeight,
      drawMode: this.drawMode,
      colors: this.palette.snapshot(),
    });
  }

  #distanceTo(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  #findAnchorNear(worldPos) {
    let bestIndex = -1;
    let bestDist = ANCHOR_PICK_RADIUS;
    this.editor.anchors.forEach((anchor, i) => {
      const d = this.#distanceTo(anchor, worldPos);
      if (d <= bestDist) {
        bestDist = d;
        bestIndex = i;
      }
    });
    return bestIndex;
  }

  #findHandleNear(worldPos) {
    const index = this.editor.selectedIndex;
    if (index === null) return null;
    const anchor = this.editor.anchors[index];
    if (!anchor) return null;

    for (const which of ['handleOut', 'handleIn']) {
      const handle = anchor[which];
      if (handle && this.#distanceTo(handle, worldPos) <= HANDLE_PICK_RADIUS) {
        return { index, which };
      }
    }
    return null;
  }

  #wireShapeSettings() {
    const nailCountInput = document.getElementById('shapeNailCountInput');
    nailCountInput.value = String(this.nailCount);
    nailCountInput.addEventListener('change', () => {
      const value = parseInt(nailCountInput.value, 10);
      if (Number.isInteger(value) && value >= MIN_NAIL_COUNT) this.nailCount = value;
      else nailCountInput.value = String(this.nailCount);
      this.#saveDraft();
    });

    const leapInput = document.getElementById('shapeLeapInput');
    leapInput.value = String(this.leap);
    leapInput.addEventListener('change', () => {
      const value = parseInt(leapInput.value, 10);
      if (Number.isInteger(value)) this.leap = value;
      else leapInput.value = String(this.leap);
      this.#saveDraft();
    });

    const heightInput = document.getElementById('shapeHeightInput');
    const useGlobalHeightCheckbox = document.getElementById('shapeUseGlobalHeightCheckbox');
    useGlobalHeightCheckbox.checked = this.useGlobalHeight;
    heightInput.disabled = this.useGlobalHeight;
    useGlobalHeightCheckbox.addEventListener('change', () => {
      this.useGlobalHeight = useGlobalHeightCheckbox.checked;
      heightInput.disabled = this.useGlobalHeight;
      this.#saveDraft();
    });
    heightInput.addEventListener('change', () => {
      const value = parseFloat(heightInput.value);
      this.heightOverride = Number.isFinite(value) ? value : null;
      this.#saveDraft();
    });

    new StrokeWeightUI(
      { input: document.getElementById('shapeStrokeWeightInput'), applyBtn: document.getElementById('applyShapeStrokeWeightBtn') },
      this.strokeWeight,
      (weight) => {
        this.strokeWeight = weight;
        this.#saveDraft();
      }
    ).init();

    const useGlobalWeightCheckbox = document.getElementById('shapeUseGlobalWeightCheckbox');
    useGlobalWeightCheckbox.checked = this.useGlobalWeight;
    useGlobalWeightCheckbox.addEventListener('change', () => {
      this.useGlobalWeight = useGlobalWeightCheckbox.checked;
      this.#saveDraft();
    });

    document.getElementById('commitShapeBtn').addEventListener('click', this.handleCommitShape);
  }

  #wireEditingButtons() {
    document.getElementById('closeShapeBtn').addEventListener('click', () => this.editor.close());
    document.getElementById('undoAnchorBtn').addEventListener('click', () => this.editor.undoLastAnchor());
    document.getElementById('resetShapeBtn').addEventListener('click', this.handleResetShape);
  }

  /** "Clear Canvas" - wipes this browser's persisted library + draft, and the in-memory library/editor to match (so every dimmed committed-shape reference and the in-progress shape both disappear, not just the draft - see "Reset Shape" for a draft-only clear). Settings fields (nails/leap/height/weight/palette) are left as-is, same reasoning `handleResetShape` already follows: only the shape/library data itself is "saved data," not the live session's current tool settings. */
  #wirePersistenceControls() {
    document.getElementById('clearSavedDataBtn').addEventListener('click', () => {
      clearFromStorage(SHAPE_LIBRARY_STORAGE_KEY);
      clearFromStorage(SHAPE_DRAFT_STORAGE_KEY);
      this.library.clear();
      this.handleResetShape();
    });
  }

  #wireDrawModeToggle() {
    const btn = document.getElementById('drawModeToggleBtn');
    const setLabel = () => {
      btn.textContent = this.drawMode === 'freehand' ? 'Draw Mode: Freehand' : 'Draw Mode: Anchors';
    };
    setLabel();
    btn.addEventListener('click', () => {
      this.drawMode = this.drawMode === 'freehand' ? 'anchor' : 'freehand';
      setLabel();
      this.#saveDraft();
    });
  }

  #wirePresetButtons() {
    const dropAt = (anchors) => this.editor.loadPreset(anchors);
    const center = () => this.viewport.toWorld(this.canvasWidth / 2, this.canvasHeight / 2);

    document.getElementById('presetCircleBtn').addEventListener('click', () => {
      dropAt(circleAnchors(center(), PRESET_RADIUS));
    });
    document.getElementById('presetOvalBtn').addEventListener('click', () => {
      dropAt(ovalAnchors(center(), PRESET_RADIUS * 1.4, PRESET_RADIUS * 0.8));
    });
    document.getElementById('presetTriangleBtn').addEventListener('click', () => {
      dropAt(triangleAnchors(center(), PRESET_RADIUS));
    });
    document.getElementById('presetRectBtn').addEventListener('click', () => {
      dropAt(rectAnchors(center(), PRESET_RADIUS));
    });
  }

  #createCanvas() {
    const renderer = createCanvas(this.canvasWidth, this.canvasHeight);
    renderer.canvas.classList.add('centered-canvas');
  }
}
