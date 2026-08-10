# Epic: Freestyle page (`/freestyle`)

**Status:** Step 1 (backlog items 1, 3, 5 in cut-down form, plus the canvas-size half of item 2)
is implemented and verified. Delivered incrementally, one item at a time, each scoped with its
own round of questions before code is written. **See [freestyle-progress.md](freestyle-progress.md)
for the running done/not-done checklist** — this doc holds the backlog wording and the *why*
behind each decision; that one is the at-a-glance *what's done*.

## Goal

A second page alongside the existing grid tool. Same underlying idea (place control points,
weave a multi-color string-art curve between them, save/reuse shapes as patterns) but on a
**blank canvas with no predefined nail grid** — points go exactly where you click. The end
product is a print/export the string artist sticks to a physical board and hammers nails into
directly, so real-world physical accuracy (canvas size, point spacing, export scale) matters a
lot more here than it did for the grid tool.

## Backlog (raw, as given — will be refined into its own section/spec as each is tackled)

1. **New page with a blank canvas** — a `/freestyle` page, empty p5 canvas, no grid drawn.
2. **"Foaie de calcul" capability** — spreadsheet-style unit handling (e.g. `cm = 10 × mm`),
   applied to pixels — real-world-unit ↔ pixel conversion.
3. **Canvas size pre-selection** — pick the canvas dimensions (default example given: 600×400px),
   canvas centered on screen.
4. **Number of colors pre-selection** — choose how many colors/layers to weave with (not fixed
   at 8 like the grid tool); possible later extension to a *per-pattern* color count. More colors
   → more subdivision points between each pair of control points (today's `segments` parameter).
5. **Freestyle pattern creation** — click anywhere to place a control point (no snapping to a
   grid); otherwise the same curve-building flow as today (Reset, Clear All, Undo, colors,
   patterns).
6. **Display with hover — greyed out or not** — some kind of hover-driven visibility/emphasis
   toggle (exact behavior TBD).
7. **V / H / arrow keys for pattern apply** — keyboard-driven pattern placement (flip
   vertical/horizontal, nudge with arrow keys — exact behavior TBD).
8. **Drag & drop a point from a selected pattern** — reshape a stamped pattern by dragging one of
   its points, with a toggle for whether the edit applies to *all* stamped copies of that pattern
   or *only* the one being dragged.
9. **Export image** — nails-only, and nails+lines, for printing and transferring to the physical
   board (formats mentioned: PDF, JPEG).

## Decisions

### Step 1 — new page, blank canvas, canvas size (✅ implemented)

- **Route:** `freestyle/index.html`, served at `/freestyle/` on GitHub Pages — same mechanism as
  `/` today, zero config needed. Cross-page nav is a small relative link in each page's top-right
  corner (`freestyle/` from root, `../` from freestyle — deliberately relative, since the site is
  deployed under a repo subpath on GitHub Pages, not domain root).
- **Code reuse:** builds on the existing `src/` classes as planned — `Viewport`, `StrokePalette`,
  `CurveStore`, `SelectionStore`, `PatternStore`, `FavoritesStore`, `StringArtRenderer`,
  `CanvasView`, `JsonFile`, `Panel`, `PanelGroup`, `MenuUI`, `ColorPickerUI`, `FavoritesUI`. `Grid`
  is **not** used - points land exactly where clicked, no snapping. The grid tool itself only
  changed in two small, backward-compatible ways (see "Shared-code changes" below).
- **Default canvas size: 20×20cm @ 90 DPI** (709×709px - `DEFAULT_DPI` in `src/freestyle/units.js`,
  size computed from it rather than hardcoded, so the two can't drift apart). Originally shipped
  as a placeholder 600×400px @ 96 DPI, corrected once the real default was known. Centered via CSS
  (`position:absolute` + `transform: translate(-50%,-50%)` on the canvas element, in the shared
  `css/canvas-frame.css` - see "Grid tool gets the same treatment" below).
- **Canvas size picker:** a "Canvas Size" submenu (`CanvasSizeUI`, mutually exclusive with
  Colors/Patterns via the same `PanelGroup`) - preset dropdown (20×20, 30×30, 30×40, 40×40,
  50×50 cm, applies immediately on selection) + custom width/height text fields (accept "20cm",
  "600px", or a bare number defaulting to px; applied via an explicit Apply button) + a DPI
  number field controlling the unit→pixel ratio (starts at the 90 DPI default, editable).
- **Changing canvas size:** clears curves, the in-progress selection, and the active pattern
  selection, then calls p5's `resizeCanvas` - a clean slate at the new size, as decided.
- **Patterns on freestyle:** no Manual/Auto toggle (there's no grid to auto-stamp across) -
  clicking a saved pattern arms it, then a canvas click stamps one copy anchored exactly there
  (`FreestylePatternStamper`, the no-grid counterpart to `PatternStamper`).

#### New files

`src/freestyle/`: `units.js` (+test - pure cm/mm/in↔px conversion), `CanvasSizeUI.js`,
`FreestylePatternStamper.js` (+test), `FreestyleApp.js`, `bootstrap.js`. Plus `freestyle/index.html`.

#### Shared-code changes (both backward-compatible, grid tool unaffected)

- `PatternUI`'s `toggleModeBtn` element is now optional - omitted on freestyle, still present and
  wired on the grid tool.
- The `touchesMenus` hit-test (mousePressed, "did this click land on a menu instead of the
  canvas") was pulled out of `App.js` into `src/ui/menuHitTest.js` so `FreestyleApp` doesn't
  duplicate it. It generically checks `.closest('.panel')`, so it needed no per-submenu ID list
  and required no change when the Canvas Size submenu was added.
- Dark-themed submenu form fields (`.panel select`/`input[type=text]`/`input[type=number]` in
  `css/styles.css`) - the Canvas Size fields were plain default-browser white boxes; this fixed
  that and, being a shared rule, also themed the Patterns submenu's "name..." field on both pages.
- **Grid tool gets the same centered/framed treatment - and then some.** What was
  `css/freestyle.css` (freestyle-only: center the canvas, grey page background) turned out to
  apply equally well to the grid tool once asked for it too, so it's now `css/canvas-frame.css`,
  loaded by both pages. First cut inset the canvas by a fixed margin from the window edges; asked
  again, the actual want was for the canvas to be *sized to the grid's own bounding box* (whatever
  shape the current rows/cols/spacing produce - `Grid#boundingBox()`) plus a fixed padding, with
  the viewport panned so that box sits centered inside it - a square canvas for a roughly-square
  grid, a tall narrow one for a few columns and many rows, etc. Computed once in the constructor;
  no `windowResized` needed anymore (the canvas is no longer window-size-dependent), the CSS
  centering keeps it centered through any resize on its own.

#### Bugs caught during verification

- `#canvasSizeSubmenu` was initially missing from the CSS selector that positions submenus beside
  the main panel (`#colorFavoritesSubmenu, #patternSubmenu { position: absolute; ... }`) - it fell
  back to rendering as a normal in-flow child inside `#ui`, stacking on top of and blocking
  `#closeUiBtn`. Caught by the Playwright verification pass (a real click timeout, not a visual
  guess) and fixed by adding `#canvasSizeSubmenu` to that selector.
- `touchesMenus()` checked `document.elementFromPoint()` against p5's `mouseX`/`mouseY`
  (canvas-relative) instead of `winMouseX`/`winMouseY` (viewport-relative, what
  `elementFromPoint` actually needs). Harmless on the grid tool, where the canvas sits almost
  flush with the page origin, but freestyle's canvas is centered and can be hundreds of pixels
  away - a click on the burger icon was checked against the wrong point on the page, missed every
  menu element, and fell through as a stray canvas point placement. Fixed at the root
  (`winMouseX`/`winMouseY` in both apps) plus a second line of defense: `FreestyleApp` now
  rejects any point outside the canvas bounds regardless of cause (`src/core/bounds.js`).

### Step 2 — graph-paper canvas backdrop (✅ implemented, completes backlog item 2)

- **Division count:** the canvas divides into square cells - 100 along its *longer* side, and
  proportionally fewer along the shorter side so cells never stretch into rectangles (e.g. a 2:1
  canvas gets 100×50, not 100×100). Computed by `computeDivisions(width, height)` in the new
  `src/freestyle/graphPaperMath.js` (pure, unit-tested).
- **Line shading:** every 10th line (from the edge) is a bold grey (`stroke(70)` - started at 100,
  matching the grid tool's nail-dot color, but that read as too bright/white once built, so toned
  down); the lines between are a darker, subtler grey (`stroke(35)`). Minor lines are drawn first,
  major lines on top last, so a major line always reads as one clean, uninterrupted line through
  its intersections with minor ones (`GraphPaperRenderer.draw`).
- **Coordinate space:** drawn in world space, inside the same `viewport.applyTransform()` block as
  the curves/nails - so it pans and zooms together with the design, staying spatially "attached"
  to the board rather than fixed to the screen. That's the point: squares represent real
  proportional positions on the physical board, useful for eyeballing/counting distances.
- **Scope:** freestyle only. The grid tool has its own nail lattice as a reference grid already.

### Step 2b — live alignment-highlighted preview line (✅ implemented, completes backlog item 2)

- **What:** after the first point is placed, a "rubber band" line follows the cursor - a preview
  of the next segment before you click to commit it. Grey (`rgb(100,100,100)`, far off-axis) fades
  continuously to yellow (`rgb(255,204,0)`, the app's own gold accent) across a 50-screen-px range
  as it approaches perfectly horizontal or vertical - but red (`rgb(220,40,40)`) is **not** part of
  that fade. It's a separate, discrete signal that only appears within 1 screen px of exactly
  on-axis - a deliberate jump, not the reddest end of a gradient, so pixel-perfect alignment is
  unmistakable rather than just "the closest end of the fade so far". (Went through three rounds:
  a hard on/off gold snap at a 4px tolerance felt like an abrupt jump; a two-color grey→red fade
  fixed that but made "close enough" read as red anywhere near the aligned end; a three-stop
  grey→yellow→red gradient still faded gradually into red through orange near the end, undermining
  the "notice the discrepancy right away" goal - only reserving red for a true discrete snap
  achieves that.)
- **Alignment math:** `axisMisalignment(from, to)` (smaller of the x/y difference) and
  `alignmentCloseness(offset, maxDistance)` (0..1, linear falloff) in the pure, unit-tested
  `src/freestyle/lineAlignment.js`; `lerpColor` in the pure, unit-tested `src/freestyle/colorGradient.js`
  for the grey→yellow fade, with the red pixel-perfect check applied *before* that lerp, as a
  separate branch, not a further gradient stop. Checked in **screen space** (not world space) so
  both the fade range and the pixel-perfect threshold read the same regardless of zoom level.
- **Scope:** only the live, not-yet-placed segment. Once you click, that segment is committed and
  keeps its normal grey forever - `LivePreviewLine` is only ever drawn for `selection.lastPoint`
  (a new getter added to `SelectionStore`) → cursor, nothing retroactive.
- **Suppressed** while a pattern is armed for stamping (`patterns.isInUse`) and while the cursor is
  outside the canvas bounds (reuses `isWithinBounds` from the earlier bugfix) - same reasoning as
  not placing points off-canvas.

### Step 4 — number of colors (✅ implemented)

- **Coupling:** the weave's `segments` (subdivision fineness) always exactly equals the number of
  colors - one setting, not two, as decided. Each curve/pattern uses **its own** `colors.length`
  as `segments` at draw time (not the current live palette size), so a color-count change never
  alters how curves drawn under a previous count render - they keep their own fineness forever.
  `StringArtRenderer.drawCurve`'s `segments` param already existed for this; the grid tool doesn't
  pass it explicitly and keeps relying on the default (its palette never resizes).
- **Range:** 1–25, validated by pure `parseColorCount` in the new `src/freestyle/colorCount.js`
  (unit-tested) - rejects out-of-range or non-numeric input with an alert rather than clamping
  silently.
- **On change:** clears curves, the in-progress selection, and the active pattern selection - same
  behavior as a canvas-size change, as decided.
- **Scope:** freestyle only, as decided - the grid tool's palette stays fixed at 8.
- **UI:** a small "Colors" number field + Apply button in the main panel, right above the swatches
  it controls (`ColorCountUI`) - not a dedicated submenu, since it's a single field rather than
  the multi-field cluster Canvas Size has.

#### Shared-code changes (backward-compatible, grid tool unaffected)

- `StrokePalette#resize(newSize, fillColor)` (new) - grows/shrinks the slot array, preserving
  in-range slots' color/enabled state; only used by freestyle.
- `ColorPickerUI` now **creates** its `<input type="color">` elements itself (`rebuild()`) instead
  of assuming they already exist as static HTML - needed so the count can change at runtime. Both
  `index.html` and `freestyle/index.html`'s `#colorPickerContainer` are now empty `<div>`s; for the
  grid tool (palette always 8) this produces the exact same 8 inputs it always had, just generated
  instead of hand-authored markup.

### Still to be scoped (later steps, in backlog order)

Items 6 (hover/grey-out display), 7 (keyboard-driven pattern placement), 8 (drag-and-drop point
editing), 9 (export) — each gets its own clarifying round when we get to it.

## Working agreement for this epic

- One backlog item at a time. Each gets its own round of clarifying questions before any code
  is written, then its own implementation + verification pass (matching how the grid tool's
  refactor was verified — unit tests for pure logic, a scripted browser pass for the real
  behavior).
- This doc is the living index for the epic; expect it to grow a "## Decisions" section (and
  possibly split into per-feature docs under `docs/`) as each item gets scoped.
- Related: [overview.md](overview.md) (what the existing grid tool does and why),
  [refactor.md](refactor.md) (the current `src/` architecture this epic will build on top of).
