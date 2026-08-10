import { Viewport } from '../core/Viewport.js';
import { CanvasView } from '../core/CanvasView.js';
import { StringArtRenderer } from '../core/StringArtRenderer.js';
import { Point } from '../core/Point.js';
import { isWithinBounds } from '../core/bounds.js';
import { Curve } from '../models/Curve.js';
import { CurveStore } from '../state/CurveStore.js';
import { SelectionStore } from '../state/SelectionStore.js';
import { PatternStore } from '../state/PatternStore.js';
import { StrokePalette } from '../state/StrokePalette.js';
import { FavoritesStore } from '../state/FavoritesStore.js';
import { PanelGroup } from '../ui/PanelGroup.js';
import { MenuUI } from '../ui/MenuUI.js';
import { ColorPickerUI } from '../ui/ColorPickerUI.js';
import { FavoritesUI } from '../ui/FavoritesUI.js';
import { PatternUI } from '../ui/PatternUI.js';
import { touchesMenus } from '../ui/menuHitTest.js';
import { FreestylePatternStamper } from './FreestylePatternStamper.js';
import { CanvasSizeUI } from './CanvasSizeUI.js';
import { GraphPaperRenderer } from './GraphPaperRenderer.js';
import { LivePreviewLine } from './LivePreviewLine.js';
import { DEFAULT_DPI, toPixels } from './units.js';

// Default board: 20x20cm at the default DPI.
const DEFAULT_SIZE_CM = 20;
const DEFAULT_WIDTH = Math.round(toPixels(DEFAULT_SIZE_CM, 'cm', DEFAULT_DPI));
const DEFAULT_HEIGHT = DEFAULT_WIDTH;
const TAP_MAX_DURATION_MS = 200;
const TAP_MAX_MOVEMENT_PX = 10;

/**
 * The freestyle page, wired together - same idea as App.js (the grid tool)
 * but with no Grid: points land exactly where clicked, and the canvas is a
 * fixed, user-chosen, centered size instead of filling the window.
 */
export class FreestyleApp {
  constructor() {
    this.canvasWidth = DEFAULT_WIDTH;
    this.canvasHeight = DEFAULT_HEIGHT;
    this.dpi = DEFAULT_DPI;

    this.viewport = new Viewport();
    this.palette = new StrokePalette();
    this.favorites = new FavoritesStore();
    this.curves = new CurveStore();
    this.selection = new SelectionStore();
    this.patterns = new PatternStore();
    this.stamper = new FreestylePatternStamper(this.viewport, this.curves, this.patterns);

    this.isDragging = false;
    this.dragStart = null;
    this.touchStartTime = 0;
    this.touchStart = null;
  }

  setup = () => {
    const colorPickerContainer = document.getElementById('colorPickerContainer');
    this.colorPickerUI = new ColorPickerUI(colorPickerContainer, this.palette);
    this.colorPickerUI.init();

    // Canvas Size, Colors, and Patterns submenus all render in the same spot
    // next to the main menu - keep them mutually exclusive.
    const submenuGroup = new PanelGroup();

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
      submenuGroup
    ).init();

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
        // No toggleModeBtn: there's no grid to auto-stamp across, so
        // Manual/Auto placement doesn't apply here.
      },
      this.patterns,
      this.selection,
      this.palette,
      this.stamper,
      submenuGroup
    );
    this.patternUI.init();

    new CanvasSizeUI(
      {
        panelEl: document.getElementById('canvasSizeSubmenu'),
        openBtn: document.getElementById('openCanvasSizeBtn'),
        closeBtn: document.getElementById('closeCanvasSizeSubmenuBtn'),
        presetSelect: document.getElementById('canvasSizePreset'),
        widthInput: document.getElementById('canvasWidthInput'),
        heightInput: document.getElementById('canvasHeightInput'),
        dpiInput: document.getElementById('canvasDpiInput'),
        applyBtn: document.getElementById('applyCanvasSizeBtn'),
      },
      { widthPx: this.canvasWidth, heightPx: this.canvasHeight, dpi: this.dpi },
      this.handleResizeCanvas,
      submenuGroup
    ).init();

    new MenuUI(
      document.getElementById('burger'),
      document.getElementById('ui'),
      document.getElementById('closeUiBtn')
    ).init();

    this.#createCanvas();

    document.getElementById('resetBtn').addEventListener('click', this.handleReset);
    document.getElementById('clearAllBtn').addEventListener('click', this.handleClearAll);
    document.getElementById('undoBtn').addEventListener('click', this.handleUndo);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.handleReset();
    });
  };

  draw = () => {
    background(12);
    this.viewport.applyTransform();

    GraphPaperRenderer.draw(this.canvasWidth, this.canvasHeight);

    for (const curve of this.curves.curves) {
      if (curve.belongsToPattern(this.patterns.selectedPatternId) && !curve.previouslyDrawn) {
        curve.recolor(this.palette.getAll());
      }
      StringArtRenderer.drawCurve(curve.points, curve.colors);
      curve.previouslyDrawn = true;
    }

    if (this.selection.isReadyForCurve()) {
      StringArtRenderer.drawCurve(this.selection.points, this.palette.getAll());
    }
    CanvasView.drawGuidePath(this.selection.points);
    this.#drawLivePreviewLine();

    const preview = this.patterns.preview;
    if (preview) {
      CanvasView.drawPatternPreview(preview.pattern, preview.mousePosition);
    }
  };

  handleReset = () => {
    this.patterns.clearSelection();
    this.patternUI.resetSelectionVisual();

    if (this.selection.isReadyForCurve()) {
      this.curves.add(
        new Curve(
          this.selection.points.map((p) => p.copy()),
          this.palette.snapshot()
        )
      );
    }
    this.selection.reset();
  };

  handleClearAll = () => {
    this.selection.reset();
    this.curves.clear();
  };

  handleUndo = () => {
    if (this.curves.count > 0) this.curves.undo();
    this.selection.reset();
  };

  /** Resizes the canvas to a new pixel size, clearing the current design (no grid to reposition points against, so a clean slate is the sane default). */
  handleResizeCanvas = (widthPx, heightPx, dpi) => {
    this.patterns.clearSelection();
    this.patternUI.resetSelectionVisual();
    this.selection.reset();
    this.curves.clear();

    this.canvasWidth = widthPx;
    this.canvasHeight = heightPx;
    this.dpi = dpi;
    resizeCanvas(this.canvasWidth, this.canvasHeight);
  };

  mousePressed = () => {
    if (touchesMenus(winMouseX, winMouseY)) return;

    if (mouseButton === CENTER) {
      this.isDragging = true;
      this.dragStart = new Point(mouseX, mouseY);
      return;
    }

    this.#placeAtScreenPoint(mouseX, mouseY);
  };

  touchStarted = () => {
    this.touchStartTime = millis();
    this.touchStart = new Point(mouseX, mouseY);
    return false;
  };

  touchEnded = () => {
    const tapDuration = millis() - this.touchStartTime;
    const movedDistance = this.touchStart ? new Point(mouseX, mouseY).distanceTo(this.touchStart) : Infinity;

    if (tapDuration < TAP_MAX_DURATION_MS && movedDistance < TAP_MAX_MOVEMENT_PX) {
      this.#placeAtScreenPoint(mouseX, mouseY);
    }
    return false;
  };

  mouseDragged = () => {
    if (touches.length === 0 && this.isDragging) {
      const dx = mouseX - this.dragStart.x;
      const dy = mouseY - this.dragStart.y;
      this.viewport.panBy(dx, dy);
      this.dragStart.set(mouseX, mouseY);
    }
  };

  mouseReleased = () => {
    this.isDragging = false;
  };

  mouseWheel = (event) => {
    this.viewport.zoomBy(event.delta > 0 ? 0.9 : 1.1);
    return false;
  };

  /**
   * Places a point at a screen-space position: stamps a pattern if one is
   * active, otherwise extends the manual selection - no grid, no snapping,
   * exactly where clicked. Ignored if the resulting point falls outside the
   * canvas (e.g. a stray click that missed a menu element - see
   * src/ui/menuHitTest.js - or simply a drag that ends past the edge).
   */
  #placeAtScreenPoint(screenX, screenY) {
    const worldPos = this.viewport.toWorld(screenX, screenY);
    if (!isWithinBounds(worldPos, this.canvasWidth, this.canvasHeight)) return;

    if (this.patterns.isInUse) {
      this.stamper.stampAtScreenPoint({ x: screenX, y: screenY });
      return;
    }
    this.selection.add(worldPos);
  }

  /**
   * The "next segment" rubber-band line from the last placed point to the
   * cursor - only while actively building a manual selection (not while a
   * pattern is armed for stamping), and only once at least one point exists.
   * Skipped when the cursor isn't over the canvas (e.g. hovering a menu),
   * same bounds check as placing a point.
   */
  #drawLivePreviewLine() {
    if (this.patterns.isInUse) return;

    const from = this.selection.lastPoint;
    if (!from) return;

    const cursorWorld = this.viewport.toWorld(mouseX, mouseY);
    if (!isWithinBounds(cursorWorld, this.canvasWidth, this.canvasHeight)) return;

    LivePreviewLine.draw(this.viewport, from, cursorWorld, mouseX, mouseY);
  }

  #createCanvas() {
    const renderer = createCanvas(this.canvasWidth, this.canvasHeight);
    renderer.canvas.classList.add('centered-canvas');
  }
}
