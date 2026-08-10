import { Grid } from '../core/Grid.js';
import { Viewport } from '../core/Viewport.js';
import { CanvasView } from '../core/CanvasView.js';
import { StringArtRenderer } from '../core/StringArtRenderer.js';
import { Point } from '../core/Point.js';
import { Curve } from '../models/Curve.js';
import { CurveStore } from '../state/CurveStore.js';
import { SelectionStore } from '../state/SelectionStore.js';
import { PatternStore } from '../state/PatternStore.js';
import { StrokePalette } from '../state/StrokePalette.js';
import { FavoritesStore } from '../state/FavoritesStore.js';
import { PatternStamper } from './PatternStamper.js';
import { MenuUI } from '../ui/MenuUI.js';
import { ColorPickerUI } from '../ui/ColorPickerUI.js';
import { FavoritesUI } from '../ui/FavoritesUI.js';
import { PatternUI } from '../ui/PatternUI.js';

const GRID_CONFIG = { rows: 15, cols: 13, spacing: 60 };
GRID_CONFIG.rowHeight = (GRID_CONFIG.spacing * Math.sqrt(3)) / 2;

const NEAREST_NAIL_RADIUS = 10;
const TAP_MAX_DURATION_MS = 200;
const TAP_MAX_MOVEMENT_PX = 10;

/**
 * The whole app, wired together. Replaces main.js as the p5 sketch entry
 * point; everything it used to do inline (grid math, pan/zoom, string-art
 * weaving, DOM wiring) now lives in its own class - this just owns instances
 * of them and hooks them up to p5's lifecycle callbacks.
 */
export class App {
  constructor() {
    this.grid = new Grid({ layout: 'rotated', ...GRID_CONFIG });
    this.viewport = new Viewport();
    this.palette = new StrokePalette();
    this.favorites = new FavoritesStore();
    this.curves = new CurveStore();
    this.selection = new SelectionStore();
    this.patterns = new PatternStore();
    this.stamper = new PatternStamper(this.grid, this.viewport, this.curves, this.patterns);

    // Pan-drag state.
    this.isDragging = false;
    this.dragStart = null;
    // Tap-vs-swipe detection for touch (previously implicit/undeclared globals
    // in main.js - which, being plain assignments inside an ES module, would
    // actually throw a ReferenceError under strict mode instead of creating
    // globals; touch support looks to have never really worked).
    this.touchStartTime = 0;
    this.touchStart = null;
  }

  setup = () => {
    const colorPickerContainer = document.getElementById('colorPickerContainer');
    this.colorPickerUI = new ColorPickerUI(colorPickerContainer, this.palette);
    this.colorPickerUI.init();

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
      this.colorPickerUI
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
        toggleModeBtn: document.getElementById('toggleBtn'),
      },
      this.patterns,
      this.selection,
      this.palette,
      this.stamper
    );
    this.patternUI.init();

    new MenuUI(
      document.getElementById('burger'),
      document.getElementById('ui'),
      document.getElementById('closeUiBtn')
    ).init();

    createCanvas(windowWidth, windowHeight);

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

    CanvasView.drawGridDots(this.grid.points);

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

  mousePressed = () => {
    if (this.#touchesMenus()) return;

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

  windowResized = () => {
    resizeCanvas(windowWidth, windowHeight);
  };

  /** Places a point at a screen-space position: stamps a pattern if one is active, otherwise extends the manual selection. */
  #placeAtScreenPoint(screenX, screenY) {
    if (this.patterns.isInUse) {
      this.stamper.stampAtScreenPoint({ x: screenX, y: screenY });
      return;
    }
    const worldPos = this.viewport.toWorld(screenX, screenY);
    const nearest = this.grid.findNearestPoint(worldPos, NEAREST_NAIL_RADIUS);
    if (nearest) this.selection.add(nearest.copy());
  }

  #touchesMenus() {
    const el = document.elementFromPoint(mouseX, mouseY);
    return Boolean(
      el &&
        (el.closest('button') ||
          el.closest('input') ||
          el.closest('#patternSubmenu') ||
          el.closest('#colorFavoritesSubmenu') ||
          el.closest('#ui') ||
          el.closest('#burger'))
    );
  }
}
