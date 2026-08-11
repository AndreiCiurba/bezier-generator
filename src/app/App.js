import { Grid } from '../core/Grid.js';
import { Viewport } from '../core/Viewport.js';
import { CanvasView } from '../core/CanvasView.js';
import { StringArtRenderer } from '../core/StringArtRenderer.js';
import { Point } from '../core/Point.js';
import { DeformableGrid, DEFAULT_PIN_RADIUS, DEFAULT_PIN_FALLOFF } from '../core/DeformableGrid.js';
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
import { ColorCountUI } from '../ui/ColorCountUI.js';
import { DeformationUI } from '../ui/DeformationUI.js';
import { PanelGroup } from '../ui/PanelGroup.js';
import { touchesMenus } from '../ui/menuHitTest.js';
import { isTypingTarget } from '../ui/keyboardFocus.js';
import { strokeWeightForColorCount } from '../core/strokeWeight.js';

const GRID_CONFIG = { rows: 15, cols: 13, spacing: 60 };
GRID_CONFIG.rowHeight = (GRID_CONFIG.spacing * Math.sqrt(3)) / 2;

const NEAREST_NAIL_RADIUS = 10;
// World-space pick radius for grabbing/removing an existing deformation pin -
// a touch larger than a nail's own snap radius since pins are bigger,
// deliberately-grabbable markers. Not zoom-adjusted, matching how
// NEAREST_NAIL_RADIUS already works in this file (a raw world-space
// tolerance, not a screen-space one - see freestyle's point editor for the
// zoom-adjusted alternative, used there instead for a different reason).
const PIN_PICK_RADIUS = 15;
const TAP_MAX_DURATION_MS = 200;
const TAP_MAX_MOVEMENT_PX = 10;
// Empty margin around the grid's own bounding box, on every side, when
// sizing the canvas to it - so the outermost nails don't sit flush against
// the canvas edge.
const GRID_PADDING = 50;

/**
 * The whole app, wired together. Replaces main.js as the p5 sketch entry
 * point; everything it used to do inline (grid math, pan/zoom, string-art
 * weaving, DOM wiring) now lives in its own class - this just owns instances
 * of them and hooks them up to p5's lifecycle callbacks.
 */
export class App {
  constructor() {
    this.grid = new Grid({ layout: 'rotated', ...GRID_CONFIG });
    // The canvas is sized to the grid's own bounding box (whatever shape
    // rows/cols/spacing actually produce - square, tall, wide, ...) plus a
    // padding margin, and the viewport is panned so that box sits centered
    // within it. Both the canvas element and this pan are computed once,
    // up front - the CSS that centers the canvas element on the page (see
    // .centered-canvas) does the rest, including staying centered across a
    // window resize, with no JS involved.
    const bbox = this.grid.boundingBox();
    this.viewport = new Viewport({ x: GRID_PADDING - bbox.minX, y: GRID_PADDING - bbox.minY });
    this.canvasWidth = bbox.width + GRID_PADDING * 2;
    this.canvasHeight = bbox.height + GRID_PADDING * 2;

    // Wraps `this.grid` with an (initially empty, so behaviorally identical)
    // Puppet Warp deformation layer - see DeformableGrid.js. Everything that
    // used to read `this.grid.points`/`findNearestPoint` for rendering or
    // click-handling in the *drawing* stage now reads `this.deformation`
    // instead, so curves snap to and render from *current* (possibly
    // deformed) nail positions, while `this.grid` itself stays the untouched
    // base lattice throughout.
    this.deformation = new DeformableGrid(this.grid);

    this.palette = new StrokePalette();
    this.favorites = new FavoritesStore();
    this.curves = new CurveStore();
    this.selection = new SelectionStore();
    this.patterns = new PatternStore();
    this.stamper = new PatternStamper(this.deformation, this.viewport, this.curves, this.patterns);

    // Pan-drag state.
    this.isDragging = false;
    this.dragStart = null;
    // { pin } while a Ctrl-grabbed deformation pin is actively being dragged.
    this.pinDrag = null;
    // Tap-vs-swipe detection for touch (previously implicit/undeclared globals
    // in main.js - which, being plain assignments inside an ES module, would
    // actually throw a ReferenceError under strict mode instead of creating
    // globals; touch support looks to have never really worked).
    this.touchStartTime = 0;
    this.touchStart = null;

    // Momentary pattern-flip state: true only while V/H is physically held
    // down (see setup's keydown/keyup wiring), not a toggle.
    this.flipVertical = false;
    this.flipHorizontal = false;
  }

  setup = () => {
    const colorPickerContainer = document.getElementById('colorPickerContainer');
    this.colorPickerUI = new ColorPickerUI(colorPickerContainer, this.palette);
    this.colorPickerUI.init();

    // Colors and Patterns submenus render in the same spot next to the main
    // menu, so keep them mutually exclusive - opening one closes the other.
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
        toggleModeBtn: document.getElementById('toggleBtn'),
      },
      this.patterns,
      this.selection,
      this.palette,
      this.stamper,
      submenuGroup
    );
    this.patternUI.init();

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
      submenuGroup,
      { radius: DEFAULT_PIN_RADIUS, falloff: DEFAULT_PIN_FALLOFF },
      this.handleRemoveDeformationPin,
      this.handleResetDeformation,
      this.handleSelectedPinChanged
    );
    this.deformationUI.init();

    this.colorCountUI = new ColorCountUI(
      {
        input: document.getElementById('colorCountInput'),
        applyBtn: document.getElementById('applyColorCountBtn'),
      },
      this.palette.size,
      this.handleColorCountChange
    );
    this.colorCountUI.init();

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
      if (e.key === 'Escape') {
        this.handleReset();
        return;
      }
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
    // Guards against a stuck-flipped state if focus leaves the page (e.g.
    // alt-tab) while a flip key is held, since keyup wouldn't otherwise fire.
    window.addEventListener('blur', () => {
      this.flipVertical = false;
      this.flipHorizontal = false;
    });
  };

  draw = () => {
    background(12);
    this.viewport.applyTransform();

    CanvasView.drawGridDots(this.deformation.points);

    for (const curve of this.curves.curves) {
      if (curve.belongsToPattern(this.patterns.selectedPatternId) && !curve.previouslyDrawn) {
        curve.recolor(this.palette.getAll());
      }
      // Subdivision fineness and line weight always match this curve's own
      // color count - not necessarily the *current* palette size, so
      // curves/patterns from before a color-count change keep rendering
      // exactly as drawn.
      StringArtRenderer.drawCurve(
        curve.points,
        curve.colors,
        curve.colors.length,
        strokeWeightForColorCount(curve.colors.length)
      );
      curve.previouslyDrawn = true;
    }

    if (this.selection.isReadyForCurve()) {
      StringArtRenderer.drawCurve(
        this.selection.points,
        this.palette.getAll(),
        this.palette.size,
        strokeWeightForColorCount(this.palette.size)
      );
    }
    CanvasView.drawGuidePath(this.selection.points);
    this.#drawArmedPatternPreview();

    if (this.deformationUI.isActive) {
      CanvasView.drawDeformationPins(this.deformation.pins, this.deformationUI.selectedPin);
    }

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

  /**
   * Resizes the palette to a new number of color slots (also the weave's
   * subdivision fineness and line weight - see the draw loop), clearing the
   * current design: existing curves would keep rendering correctly either
   * way (each derives its own fineness/weight from its own colors.length),
   * but starting fresh avoids the confusion of a palette that no longer
   * matches what's on screen.
   */
  handleColorCountChange = (count) => {
    this.patterns.clearSelection();
    this.patternUI.resetSelectionVisual();
    this.selection.reset();
    this.curves.clear();

    this.palette.resize(count);
    this.colorPickerUI.rebuild();
  };

  handleRemoveDeformationPin = (pin) => {
    this.deformation.removePin(pin);
    this.deformationUI.refreshPinCount(this.deformation.pins.length);
  };

  handleResetDeformation = () => {
    this.deformation.reset();
    this.deformationUI.refreshPinCount(0);
  };

  /** The selected pin's radius/falloff were edited directly in the panel, bypassing DeformableGrid's own mutators - force a recompute. */
  handleSelectedPinChanged = () => {
    this.deformation.invalidate();
  };

  mousePressed = (event) => {
    if (touchesMenus(winMouseX, winMouseY)) return;

    if (mouseButton === CENTER) {
      this.isDragging = true;
      this.dragStart = new Point(mouseX, mouseY);
      return;
    }

    if (this.deformationUI.isActive) {
      this.#handleDeformationClick(event);
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
    // Deformation Mode's pin interactions are Ctrl/Alt+Click, a keyboard+
    // mouse-only gesture with no touch equivalent - a plain tap is a no-op
    // here too, same as an unmodified click, rather than falling through to
    // placing a curve point (AC2: not a drawing action in this mode).
    if (this.deformationUI.isActive) return false;

    const tapDuration = millis() - this.touchStartTime;
    const movedDistance = this.touchStart ? new Point(mouseX, mouseY).distanceTo(this.touchStart) : Infinity;

    if (tapDuration < TAP_MAX_DURATION_MS && movedDistance < TAP_MAX_MOVEMENT_PX) {
      this.#placeAtScreenPoint(mouseX, mouseY);
    }
    return false;
  };

  mouseDragged = () => {
    if (touches.length === 0 && this.pinDrag) {
      const worldPos = this.viewport.toWorld(mouseX, mouseY);
      this.deformation.movePin(this.pinDrag.pin, worldPos);
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
    this.pinDrag = null;
  };

  mouseWheel = (event) => {
    this.viewport.zoomBy(event.delta > 0 ? 0.9 : 1.1);
    return false;
  };

  /** Places a point at a screen-space position: stamps a pattern if one is active, otherwise extends the manual selection. */
  #placeAtScreenPoint(screenX, screenY) {
    if (this.patterns.isInUse) {
      this.stamper.stampAtScreenPoint(
        { x: screenX, y: screenY },
        { horizontal: this.flipHorizontal, vertical: this.flipVertical }
      );
      return;
    }
    const worldPos = this.viewport.toWorld(screenX, screenY);
    // Current (possibly deformed) nail positions, not the base grid's own -
    // so curve points snap to and render from wherever the nails actually
    // are right now (epic AC10).
    const nearest = this.deformation.findNearestPoint(worldPos, NEAREST_NAIL_RADIUS);
    if (nearest) this.selection.add(nearest.copy());
  }

  /**
   * Handles a click while Deformation Mode is active (see DeformationUI) -
   * Ctrl+Click a pin drags it (or creates one, anchored on the nearest
   * *base* nail, if none was hit), Alt+Click a pin removes it, and a plain
   * click on a pin just selects it (populates the panel's radius/falloff
   * fields) without moving or creating anything - not a drawing action
   * either way (AC2).
   * @param {MouseEvent} [event] the native DOM event p5 passes through -
   *   read directly for `ctrlKey`/`altKey` rather than tracking our own
   *   continuous keydown/keyup state, since (unlike freestyle's hold-V/H/
   *   Ctrl highlighting) nothing here needs to react to a key being held
   *   *without* a click.
   */
  #handleDeformationClick(event) {
    const worldPos = this.viewport.toWorld(mouseX, mouseY);

    if (event?.altKey) {
      const pin = this.deformation.findNearestPin(worldPos, PIN_PICK_RADIUS);
      if (!pin) return;
      this.deformation.removePin(pin);
      this.deformationUI.refreshPinCount(this.deformation.pins.length);
      if (this.deformationUI.selectedPin === pin) this.deformationUI.setSelectedPin(null);
      return;
    }

    if (event?.ctrlKey) {
      let pin = this.deformation.findNearestPin(worldPos, PIN_PICK_RADIUS);
      if (!pin) {
        const nail = this.grid.findNearestPoint(worldPos, NEAREST_NAIL_RADIUS);
        if (!nail) return;
        pin = this.deformation.addPin({
          referencePosition: nail,
          radius: this.deformationUI.defaultRadius,
          falloff: this.deformationUI.defaultFalloff,
        });
        this.deformationUI.refreshPinCount(this.deformation.pins.length);
      }
      this.pinDrag = { pin };
      this.deformationUI.setSelectedPin(pin);
      return;
    }

    this.deformationUI.setSelectedPin(this.deformation.findNearestPin(worldPos, PIN_PICK_RADIUS));
  }

  /**
   * The ghost preview for the armed pattern (selected, Manual mode) - follows
   * the cursor on the canvas, greyed out, flip-aware. Separate from
   * `patterns.preview` (the list-row hover preview, kept as-is above) - both
   * can show at once, e.g. if a pattern's armed and you're also browsing the
   * list, though that's a rare edge case in practice.
   */
  #drawArmedPatternPreview() {
    if (!this.patterns.isInUse || this.patterns.placementMode !== 'manual') return;
    if (touchesMenus(winMouseX, winMouseY)) return;

    const pattern = this.patterns.selectedPattern;
    if (!pattern) return;

    const cursorWorld = this.viewport.toWorld(mouseX, mouseY);
    CanvasView.drawArmedPatternPreview(pattern, cursorWorld, {
      horizontal: this.flipHorizontal,
      vertical: this.flipVertical,
    });
  }

  #createCanvas() {
    const renderer = createCanvas(this.canvasWidth, this.canvasHeight);
    renderer.canvas.classList.add('centered-canvas');
  }
}
