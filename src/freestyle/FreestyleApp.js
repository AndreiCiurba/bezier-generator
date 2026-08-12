import { Viewport } from '../core/Viewport.js';
import { CanvasView } from '../core/CanvasView.js';
import { StringArtRenderer } from '../core/StringArtRenderer.js';
import { Point } from '../core/Point.js';
import { isWithinBounds } from '../core/bounds.js';
import { findNearestCurvePoint, shiftSiblingPoints } from '../core/pointEditing.js';
import { Curve, isLiveAutoPatternCurve } from '../models/Curve.js';
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
import { ColorCountUI } from '../ui/ColorCountUI.js';
import { touchesMenus } from '../ui/menuHitTest.js';
import { isTypingTarget } from '../ui/keyboardFocus.js';
import { BASELINE_STROKE_WEIGHT } from '../core/strokeWeight.js';
import { FreestylePatternStamper } from './FreestylePatternStamper.js';
import { CanvasSizeUI } from './CanvasSizeUI.js';
import { StrokeWeightUI } from '../ui/StrokeWeightUI.js';
import { GraphPaperRenderer } from './GraphPaperRenderer.js';
import { LivePreviewLine } from './LivePreviewLine.js';
import { ExportRenderer } from '../core/ExportRenderer.js';
import { downloadCanvasPng } from '../io/PngFile.js';
import { DEFAULT_DPI, toPixels } from './units.js';

// Default board: 20x20cm at the default DPI.
const DEFAULT_SIZE_CM = 20;
const DEFAULT_WIDTH = Math.round(toPixels(DEFAULT_SIZE_CM, 'cm', DEFAULT_DPI));
const DEFAULT_HEIGHT = DEFAULT_WIDTH;
const TAP_MAX_DURATION_MS = 200;
const TAP_MAX_MOVEMENT_PX = 10;
// Screen-space pick radius for grabbing a control point with ctrl-click -
// same tolerance the grid tool uses for nail snapping (NEAREST_NAIL_RADIUS).
const CONTROL_POINT_PICK_RADIUS_PX = 10;

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

    // Momentary pattern-flip state: true only while V/H is physically held
    // down (see setup's keydown/keyup wiring), not a toggle.
    this.flipVertical = false;
    this.flipHorizontal = false;

    // Control-point editor (backlog item 8): Ctrl held (and nothing else
    // armed/in-progress) highlights every curve's points; ctrl-clicking one
    // and dragging reshapes that curve live; holding Shift too moves the
    // same point on every other curve stamped from the same pattern along
    // with it. `pointEdit` is set only while a drag is actually in progress.
    this.ctrlHeld = false;
    this.shiftHeld = false;
    this.pointEdit = null;

    // "Foaie de calcul" graph-paper backdrop visibility - on by default
    // (today's only behavior); a small menu toggle can now hide it. Editing-
    // only - the PNG exports never draw it, regardless of this setting.
    this.showGraphPaper = true;

    // Set when "Save current pattern" is clicked, to the new pattern's id -
    // so that *if* the selection it was saved from goes on to be committed
    // unchanged (Reset/Escape), the resulting curve is tagged with that same
    // patternId instead of null. That's what lets the original hand-drawn
    // shape move along with the pattern's stamped copies under ctrl-shift
    // dragging, not just the copies. Invalidated (see #placeAtScreenPoint) if
    // another point gets added before the commit, since the shape would no
    // longer match what was actually saved.
    this.pendingOriginPatternId = null;

    // The pixel thickness new curves get woven with, set directly (not
    // derived from color count - see StrokeWeightUI) so the artist can match
    // the actual thread they're using. Applies to curves created *from now
    // on* only - see Curve#renderWeight, same "keeps its own value forever"
    // treatment as colors/segments.
    this.strokeWeight = BASELINE_STROKE_WEIGHT;
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
      submenuGroup,
      (newSize) => this.colorCountUI.setCount(newSize)
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
      submenuGroup,
      (patternId) => {
        this.pendingOriginPatternId = patternId;
      }
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

    this.colorCountUI = new ColorCountUI(
      {
        input: document.getElementById('colorCountInput'),
        applyBtn: document.getElementById('applyColorCountBtn'),
      },
      this.palette.size,
      this.handleColorCountChange
    );
    this.colorCountUI.init();

    this.strokeWeightUI = new StrokeWeightUI(
      {
        input: document.getElementById('strokeWeightInput'),
        applyBtn: document.getElementById('applyStrokeWeightBtn'),
      },
      this.strokeWeight,
      (weight) => {
        this.strokeWeight = weight;
      }
    );
    this.strokeWeightUI.init();

    new MenuUI(
      document.getElementById('burger'),
      document.getElementById('ui'),
      document.getElementById('closeUiBtn')
    ).init();

    this.#createCanvas();

    document.getElementById('resetBtn').addEventListener('click', this.handleReset);
    document.getElementById('clearAllBtn').addEventListener('click', this.handleClearAll);
    document.getElementById('undoBtn').addEventListener('click', this.handleUndo);
    document.getElementById('undoLineBtn').addEventListener('click', this.handleUndoLine);
    document.getElementById('exportNailsBtn').addEventListener('click', this.handleExportNails);
    document
      .getElementById('exportNailsStringsBtn')
      .addEventListener('click', this.handleExportNailsAndStrings);

    const graphPaperToggle = document.getElementById('toggleGraphPaperInput');
    graphPaperToggle.checked = this.showGraphPaper;
    graphPaperToggle.addEventListener('change', () => {
      this.showGraphPaper = graphPaperToggle.checked;
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.handleReset();
        return;
      }
      if (isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === 'v') this.flipVertical = true;
      if (key === 'h') this.flipHorizontal = true;
      if (key === 'control') this.ctrlHeld = true;
      if (key === 'shift') this.shiftHeld = true;
    });
    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (key === 'v') this.flipVertical = false;
      if (key === 'h') this.flipHorizontal = false;
      if (key === 'control') this.ctrlHeld = false;
      if (key === 'shift') this.shiftHeld = false;
    });
    // Guards against a stuck-flipped/stuck-editing state if focus leaves the
    // page (e.g. alt-tab) while a key's held, since keyup wouldn't otherwise
    // fire - also drops any in-progress point drag, same reasoning.
    window.addEventListener('blur', () => {
      this.flipVertical = false;
      this.flipHorizontal = false;
      this.ctrlHeld = false;
      this.shiftHeld = false;
      this.pointEdit = null;
    });
  };

  draw = () => {
    background(12);
    this.viewport.applyTransform();

    if (this.showGraphPaper) GraphPaperRenderer.draw(this.canvasWidth, this.canvasHeight);

    for (const curve of this.curves.curves) {
      if (isLiveAutoPatternCurve(curve, this.patterns)) {
        // Auto-stamped and still the active selection - keep tracking the
        // *current* palette/stroke weight for as long as that stays true
        // (see Curve.js's own doc). Freestyle has no Auto placement UI, so
        // this branch is unreachable here today - kept for consistency with
        // the shared grid-tool/3D behavior, not dead weight to remove.
        curve.recolor(this.palette.getAll());
        curve.weight = this.strokeWeight;
      } else if (curve.belongsToPattern(this.patterns.selectedPatternId) && !curve.previouslyDrawn) {
        curve.recolor(this.palette.getAll());
      }
      // Subdivision fineness always matches this curve's own color count;
      // weight is its own explicit setting if it has one (the "Stroke
      // Weight" field, see StrokeWeightUI) or the same color-count-derived
      // fallback as before - either way, never the *current* setting (unless
      // it's still a live Auto-pattern curve, handled above), so
      // curves/patterns from before a change keep rendering exactly as drawn.
      StringArtRenderer.drawCurve(curve.points, curve.colors, curve.colors.length, curve.renderWeight);
      curve.previouslyDrawn = true;
    }

    if (this.selection.isReadyForCurve()) {
      StringArtRenderer.drawCurve(this.selection.points, this.palette.getAll(), this.palette.size, this.strokeWeight);
    }
    CanvasView.drawGuidePath(this.selection.points);
    this.#drawLivePreviewLine();
    this.#drawArmedPatternPreview();
    this.#drawControlPointHighlights();

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
          this.palette.snapshot(),
          this.pendingOriginPatternId,
          this.strokeWeight
        )
      );
    }
    this.selection.reset();
    this.pendingOriginPatternId = null;
  };

  handleClearAll = () => {
    this.selection.reset();
    this.curves.clear();
    this.pendingOriginPatternId = null;
  };

  /** Undoes the whole current figure - the last committed curve, however many lines/points it has, plus whatever's still in progress. */
  handleUndo = () => {
    if (this.curves.count > 0) this.curves.undo();
    this.selection.reset();
  };

  /**
   * Undoes just the most recent point of the figure currently being built -
   * one step back, not the whole figure (see `handleUndo` for that). A no-op
   * once nothing's in progress; doesn't touch already-committed curves.
   */
  handleUndoLine = () => {
    this.selection.undoLast();
  };

  /** Nails only (control + inner points), no strings - see ExportRenderer. */
  handleExportNails = () => {
    this.#exportPng('freestyle-nails.png', ExportRenderer.renderNails);
  };

  /** Nails plus the actual woven strings, in their real colors. */
  handleExportNailsAndStrings = () => {
    this.#exportPng('freestyle-nails-strings.png', ExportRenderer.renderNailsAndStrings);
  };

  /**
   * Shared PNG-export plumbing for both buttons: renders onto a throwaway
   * offscreen buffer at the canvas's own pixel size (already calibrated to
   * the real-world size via the DPI setting - see units.js - so no extra
   * scaling is needed for print accuracy) and triggers a download.
   * @param {string} filename
   * @param {(pg: import('p5'), curves: import('../models/Curve.js').Curve[]) => void} render
   */
  #exportPng(filename, render) {
    const curves = this.#curvesForExport();
    if (curves.length === 0) {
      alert('Nothing to export yet - place some points first.');
      return;
    }

    const pg = createGraphics(this.canvasWidth, this.canvasHeight);
    render(pg, curves);
    downloadCanvasPng(pg.canvas, filename);
    pg.remove();
  }

  /**
   * Every curve that's actually visible right now - the committed ones plus
   * the in-progress selection, if it's far enough along to render as a curve
   * (matches exactly what the draw loop itself renders, so the export is a
   * faithful "what you see" snapshot).
   */
  #curvesForExport() {
    const curves = this.curves.curves.slice();
    if (this.selection.isReadyForCurve()) {
      curves.push(new Curve(this.selection.points, this.palette.getAll(), null, this.strokeWeight));
    }
    return curves;
  }

  /**
   * Resizes the palette to a new number of color slots (also the weave's
   * subdivision fineness - see the draw loop), clearing the current design
   * for the same reason a canvas resize does: existing curves keep whatever
   * color count they were drawn with (rendering stays correct either way -
   * see the draw loop), but starting fresh avoids the confusion of a
   * palette that no longer matches what's on screen.
   */
  handleColorCountChange = (count) => {
    this.patterns.clearSelection();
    this.patternUI.resetSelectionVisual();
    this.selection.reset();
    this.curves.clear();
    this.pendingOriginPatternId = null;

    this.palette.resize(count);
    this.colorPickerUI.rebuild();
  };

  /** Resizes the canvas to a new pixel size, clearing the current design (no grid to reposition points against, so a clean slate is the sane default). */
  handleResizeCanvas = (widthPx, heightPx, dpi) => {
    this.patterns.clearSelection();
    this.patternUI.resetSelectionVisual();
    this.selection.reset();
    this.curves.clear();
    this.pendingOriginPatternId = null;

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

    if (this.#tryStartPointEdit()) return;

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
    if (touches.length === 0 && this.pointEdit) {
      this.#dragActivePoint();
      return;
    }
    if (touches.length === 0 && this.isDragging) {
      const dx = mouseX - this.dragStart.x;
      const dy = mouseY - this.dragStart.y;
      this.viewport.panBy(dx, dy);
      this.dragStart.set(mouseX, mouseY);
    }
  };

  mouseReleased = () => {
    this.isDragging = false;
    this.pointEdit = null;
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
      this.stamper.stampAtScreenPoint(
        { x: screenX, y: screenY },
        { horizontal: this.flipHorizontal, vertical: this.flipVertical },
        this.strokeWeight
      );
      return;
    }
    this.selection.add(worldPos);
    // A saved pattern's origin tag only applies if the shape it was saved
    // from is committed unchanged - another point added after saving means
    // it no longer matches, so the eventual commit should go back to a plain
    // (patternId: null) curve.
    this.pendingOriginPatternId = null;
  }

  /**
   * True when nothing else claims the canvas - no pattern armed for
   * stamping, no in-progress manual curve - so ctrl-drag point editing is
   * allowed. Same "nothing else going on" gate for both starting a drag and
   * drawing the highlight overlay.
   */
  #canEditPoints() {
    return !this.patterns.isInUse && this.selection.count === 0;
  }

  /**
   * Ctrl-click a control point to start dragging it: hit-tests every curve's
   * points against the click, in screen space (so the pick radius stays a
   * constant number of pixels regardless of zoom). Returns whether a drag
   * was actually started, so the caller can skip the normal
   * place-a-point/stamp-a-pattern click handling when it was.
   */
  #tryStartPointEdit() {
    if (!this.ctrlHeld || !this.#canEditPoints()) return false;

    const worldPos = this.viewport.toWorld(mouseX, mouseY);
    const hit = findNearestCurvePoint(
      this.curves.curves,
      worldPos,
      CONTROL_POINT_PICK_RADIUS_PX / this.viewport.zoom
    );
    if (!hit) return false;

    this.pointEdit = { curve: hit.curve, pointIndex: hit.pointIndex };
    return true;
  }

  /**
   * Drags the actively-grabbed control point to the cursor's current world
   * position - the curve it belongs to reshapes live. With Shift held, the
   * same point on every other curve stamped from the same pattern moves by
   * the same per-frame delta, so all copies stay in sync as you drag
   * (backlog item 8's "all copies vs. just one" toggle).
   */
  #dragActivePoint() {
    const { curve, pointIndex } = this.pointEdit;
    const point = curve.points[pointIndex];
    const worldPos = this.viewport.toWorld(mouseX, mouseY);
    const dx = worldPos.x - point.x;
    const dy = worldPos.y - point.y;

    point.set(worldPos.x, worldPos.y);
    if (this.shiftHeld) {
      shiftSiblingPoints(this.curves.curves, curve, pointIndex, dx, dy);
    }
  }

  /**
   * Highlights every curve's control points while Ctrl is held and nothing
   * else is armed/in-progress - the "see all the points" half of backlog
   * item 8, independent of whether a drag is actually happening.
   */
  #drawControlPointHighlights() {
    if (!this.ctrlHeld || !this.#canEditPoints()) return;
    CanvasView.drawControlPointHighlights(this.curves.curves, this.pointEdit);
  }

  /**
   * The ghost preview for the armed pattern (selected for stamping) -
   * follows the cursor, greyed out, flip-aware. Separate from
   * `patterns.preview` (the list-row hover preview, kept as-is below) - both
   * can show at once, e.g. if a pattern's armed and you're also browsing the
   * list, though that's a rare edge case in practice.
   */
  #drawArmedPatternPreview() {
    if (!this.patterns.isInUse) return;

    const pattern = this.patterns.selectedPattern;
    if (!pattern) return;

    const cursorWorld = this.viewport.toWorld(mouseX, mouseY);
    if (!isWithinBounds(cursorWorld, this.canvasWidth, this.canvasHeight)) return;
    if (touchesMenus(winMouseX, winMouseY)) return;

    CanvasView.drawArmedPatternPreview(
      pattern,
      cursorWorld,
      { horizontal: this.flipHorizontal, vertical: this.flipVertical },
      this.strokeWeight
    );
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
