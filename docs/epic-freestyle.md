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

### Step 4 — number of colors (✅ implemented, since expanded to both pages)

Landed in two passes: first freestyle-only, then - on request - extended to the grid tool too,
with the line-weight/random-fill/auto-resize-on-import refinements below added in that second
pass.

- **Coupling:** the weave's `segments` (subdivision fineness) always exactly equals the number of
  colors - one setting, not two, as decided. Each curve/pattern uses **its own** `colors.length`
  as `segments` at draw time (not the current live palette size), so a color-count change never
  alters how curves drawn under a previous count render - they keep their own fineness forever.
- **Range:** 1–25, validated by pure `parseColorCount` in `src/state/colorCount.js` (unit-tested) -
  rejects out-of-range or non-numeric input with an alert rather than clamping silently.
- **On change:** clears curves, the in-progress selection, and the active pattern selection - same
  behavior as a canvas-size change, as decided.
- **Scope: both pages now.** Originally freestyle-only, as decided in the first pass; extended to
  the grid tool on request in the second. The grid tool gets the identical "Colors" field + Apply
  button, right above its swatches, same as freestyle.
- **UI:** a small "Colors" number field + Apply button, right above the swatches it controls
  (`ColorCountUI`) - not a dedicated submenu, since it's a single field rather than the multi-field
  cluster Canvas Size has.

#### Line weight scales with color count too (follow-up in the same step)

Exactly today's weight (0.6) at 8 colors - changing the count is a no-op for anyone who leaves it
at the default - thicker for fewer, thinner for more.

- **First cut:** inverse-square-root falloff, chosen so the thin end would taper "gently" rather
  than collapse toward a hairline. In practice this flattened out too much past 8 colors to read
  as a real change ("this seems visually almost unchanged" feedback) - 25 colors still looked like
  a near-solid wedge because the extra segments' density outweighed the barely-thinner individual
  lines.
- **Fixed:** switched to **plain inverse proportionality** (`strokeWeightForColorCount` in
  `src/core/strokeWeight.js`, pure, unit-tested) - double the colors, half the weight. Quadruples
  by 2 colors, and by 25 colors the weight is under a third of baseline, which is what actually
  makes individual strands read as thin instead of merging into a blob.
- `StringArtRenderer.drawCurve` grew a 4th `weight` param (default 0.6, so any call site that
  doesn't pass it explicitly is unaffected); each curve/pattern's weight is derived from its own
  `colors.length`, same "keeps its own fineness" reasoning as the segments coupling above.

#### Newly-added slots get a random color, not white

Growing the count used to fill new slots with a flat `#ffffff`. `StrokePalette#resize` now takes a
`fillColorFn` (default `randomHexColor` from the new `src/utils/color.js`), called once **per** new
slot - several new swatches now come in visibly distinct colors instead of a wall of white.

#### Applying a favorite bundle auto-resizes the palette to match

"If I export with 11 colors, it should automatically update it to be 11, even though it's preset
to 8." `FavoritesUI#applyBundle` now resizes the palette to `bundle.length` first (if different
from the current size) via the same `StrokePalette#resize`, rebuilds the color pickers, and (via a
new `onPaletteResize` constructor callback) tells the page's `ColorCountUI` to reflect the new
count - before applying the bundle's actual colors. Works for any bundle, not just freshly-imported
ones, since the trigger is *applying* (clicking) a bundle, not the import step itself - a
multi-bundle import can't have one universal color count, but each bundle you actually click can
size the palette to itself.

#### E2e-verified (asked for explicitly both times - see the `no-e2e` skill)

First pass: picker count and the `colorCountInput` default confirmed at 8 on freestyle; a 3-point
curve arranged so `colorCount=1` degenerates the weave to one single isolated line (segments=1
only ever draws p1→p3 directly) gave a clean line to pixel-measure, confirming the formula was
actually wired into rendering; screenshots across 1/2/8/25 colors.

Second pass (after the four changes above): same defaults/picker-count checks now also run against
the grid tool; growing the grid tool's palette 3→6 and freestyle's 8→12 both produced distinct,
non-white new colors; the same isolated-line measurement at `colorCount=1` grew from 7px to 10px
under the new (steeper) formula, confirming the change actually reached rendering; screenshots
across 1/2/8/25 again, now showing a *much* more visible progression (25 colors shows individual
thin strands, not a near-solid wedge); saved an 11-color bundle, reset the palette to 8, applied
the saved bundle, and confirmed both the picker count and the `colorCountInput` field correctly
jumped back to 11.

#### Shared-code changes

- `StrokePalette#resize(newSize, fillColorFn)` - grows/shrinks the slot array, preserving in-range
  slots' color/enabled state; each new slot gets its own call to `fillColorFn` (default random).
- `ColorPickerUI` **creates** its `<input type="color">` elements itself (`rebuild()`) instead of
  assuming they already exist as static HTML - needed so the count can change at runtime. Both
  `index.html` and `freestyle/index.html`'s `#colorPickerContainer` are empty `<div>`s as a result.
- `colorCount.js`, `ColorCountUI`, and `strokeWeight.js` all moved out of `src/freestyle/` into
  shared homes (`src/state/`, `src/ui/`, `src/core/` respectively) once the grid tool needed them
  too.

### Step 6/7 — armed-pattern hover preview, hold-V/H flip (✅ implemented, item 7 partial)

Both items scoped and built together since the flip is really an extension of the hover preview
(what gets mirrored while you decide where to click).

- **What changed about hover:** the existing list-row hover preview (`patterns.preview`,
  `CanvasView.drawPatternPreview`) only showed while your mouse was physically over a saved
  pattern's row in the submenu - not while actually aiming a click on the canvas. Confirmed with
  the user: **keep that mechanism as-is**, and *add* a second, independent one - whenever a
  pattern is armed (selected, Manual placement mode) the ghost now follows the cursor anywhere on
  the canvas, greyed out (`#c8c8c880`), continuously, derived fresh each frame straight from
  `patterns.isInUse`/`selectedPattern` rather than event-driven state - no hover-in/hover-out
  listeners needed for this half. New `CanvasView.drawArmedPatternPreview(pattern, anchorWorldPos,
  flip)`, called from a new `#drawArmedPatternPreview()` in both `App` and `FreestyleApp`, gated on
  `placementMode === 'manual'` (freestyle's is always `'manual'` - never toggled there - so the
  same check works unmodified on both pages) and suppressed over menus
  (`touchesMenus`)/off-canvas (freestyle's `isWithinBounds`).
  Also fixed while rewriting this path: the preview's density (segments/line weight) now matches
  the pattern's own `colors.length`, same coupling used everywhere else, instead of a fixed
  7-white-layer placeholder that didn't reflect what the real stamp would look like.
- **What V/H actually does:** clarified through a wrong first guess - not a toggle ("press V once
  to flip, again to un-flip"), a **momentary hold**: the preview mirrors only while the key is
  physically down, and returns to normal the instant it's released. Confirmed: the *actual stamp*
  also comes out mirrored if you click while holding - preview and placement always agree, since
  both read the same live `flipVertical`/`flipHorizontal` booleans at the moment they run.
- **Flip math:** `flipPoints(points, {horizontal, vertical})` in the new, pure, unit-tested
  `src/core/pointTransforms.js` - mirrors every point around `points[0]`, which is what gets
  anchored to the cursor/click, so the anchor itself never moves, only the rest of the shape
  flips around it. `Pattern#translatedTo` was refactored to share the same file's
  `translatePointsTo` helper (behavior-preserving DRY cleanup, not a new feature) rather than
  duplicating the offset math a third time.
- **Where flip is applied:** `PatternStamper#stampAtScreenPoint` and
  `FreestylePatternStamper#stampAtScreenPoint` both grew a `flip` parameter, applied via
  `flipPoints` + `translatePointsTo` before building the `Curve`. `stampThroughoutGrid` (Auto mode)
  intentionally does **not** take flip - there's no click/hold gesture involved, it fires
  immediately on selecting the pattern from the list.
- **Keyboard wiring:** `keydown` sets the flag (guarded by the new `isTypingTarget` so typing 'v'
  or 'h' into e.g. the pattern name field doesn't trigger a flip), `keyup` always clears it
  regardless of focus (so a focus change mid-hold can't leave it stuck on), and a `window` `blur`
  listener clears both flags too, in case focus leaves the page entirely (alt-tab) while a key's
  held, which would never deliver a `keyup` otherwise.
- **Scope:** both pages, matching how the underlying pattern/stamper infrastructure is already
  shared.
- **Still open (rest of backlog item 7):** arrow-key nudging of the armed pattern's position isn't
  built yet - a separate future round.

#### E2e-verified (asked for explicitly - see the `no-e2e` skill)

Built a 3-point "L" pattern on freestyle, confirmed the ghost preview follows the cursor while
*not* hovering the list (the actual complaint); confirmed typing "vhTest"/"hTest" as pattern names
saved correctly (the typing-guard didn't block normal input, and normal typing didn't leak into
flip state); an unguarded first attempt at the H-flip case used an out-of-bounds click target and
correctly produced *no* preview/stamp (the bounds guard working as designed, not a bug - caught by
comparing against the canvas's actual measured size and redone with an in-bounds target); the
corrected H-flip screenshot shows an unambiguous left-right mirror against two identically-oriented
unflipped shapes; the V-flip case showed an equally clear up-down mirror. Repeated a lighter version
on the grid tool (nail-snapped placement) with the same result. Zero console/page errors throughout
both passes.

### Step 8 — ctrl-drag control-point editor (✅ implemented, freestyle only)

Scoped with a round of clarifying questions before any code: freestyle-only (not the grid tool,
where a dragged point would need nail-snapping logic this round didn't cover); works on **all**
committed curves, not just pattern-stamped ones (a plain hand-drawn curve's points highlight and
drag too - Shift just has nothing extra to do for one, since there's no sibling copy to sync);
dragging edits only the curve instance(s) already on the canvas, **not** the saved pattern
template in the library (stamping that pattern again later still gives you the original shape);
and the Shift "move all copies together" sync is live, every frame, not only applied on release.

- **Ctrl held + nothing else claims the canvas** (`#canEditPoints` - `!patterns.isInUse &&
  selection.count === 0`, i.e. no pattern armed for stamping and no in-progress manual curve) -
  every curve's control points highlight, gold-accent dots (`CanvasView.drawControlPointHighlights`,
  reusing the app's own `#ffcc00` on-axis accent color from the step-2b live preview line).
- **Ctrl-click on a highlighted point** starts a drag (`#tryStartPointEdit`, hit-tested via the
  new pure `findNearestCurvePoint` in `src/core/pointEditing.js` - screen-space pick radius,
  10px, divided by zoom, so the tolerance feels the same at any zoom level, same radius the grid
  tool already uses for nail snapping). Dragging moves that point to the cursor's world position
  every frame (`#dragActivePoint`) - the curve reshapes live, same render path as any other curve.
- **Shift also held while dragging** moves the same point index on every other curve stamped from
  the same pattern (`patternId`), by the same per-frame delta - the pure `shiftSiblingPoints` in
  the same file. No-op for a manually-drawn curve (`patternId === null`) - nothing else to sync.
  This is the "all copies vs. just one" toggle from the backlog wording, expressed as a held
  modifier rather than a separate UI toggle.
- **Doesn't hit a point:** a ctrl-click that misses (nothing within the pick radius) falls through
  to the normal click handling (`#placeAtScreenPoint`) - Ctrl only special-cases a hit, it doesn't
  block placing a new point elsewhere.
- **Guarded against a stuck drag/held-key state** the same way as the V/H flip flags: `keyup`
  clears `ctrlHeld`/`shiftHeld` unconditionally, and a `window` `blur` listener clears both plus
  drops any in-progress `pointEdit`, in case focus leaves the page mid-drag (alt-tab) and no
  `keyup`/`mouseup` ever fires.
- **Active point emphasis:** the point actually being dragged renders larger/fully opaque
  (`CONTROL_POINT_ACTIVE_*` in `CanvasView`) versus the semi-transparent dots for the rest -
  affordance for which one you've grabbed, not asked for explicitly but a natural extension of
  the same draw call.

#### New files

`src/core/pointEditing.js` (+test) - pure, unit-tested `findNearestCurvePoint` and
`shiftSiblingPoints`, no p5/DOM dependency, matching the `pointTransforms.js` pattern from step 6/7.

#### Follow-up: the original hand-drawn shape now moves with its pattern's copies too

Raised after the first pass shipped: draw a shape, save it as a pattern, arm the pattern and stamp
some copies, then ctrl-shift-drag a point - the original drawing didn't move, only the stamped
copies did, since it was never actually tagged as belonging to the pattern (`patternId` stayed
`null` - saving a pattern only *copies* the selection's points into a new `Pattern`, it doesn't
link back to the curve that selection eventually becomes). Fixed rather than left as expected
behavior, since it was small: `PatternUI` now takes an optional `onPatternSaved(patternId)`
callback (only wired on freestyle - the grid tool's `PatternUI` call site is unaffected, the new
param is simply unused there), fired right after a save. `FreestyleApp` remembers that id as
`pendingOriginPatternId`; if the *same, unmodified* selection then gets committed to a curve
(Reset/Escape), that curve is tagged with it instead of `null` - so it's a real, if belated,
"stamped instance" of the pattern as far as `Curve#belongsToPattern`/`shiftSiblingPoints` are
concerned, and ctrl-shift-drag picks it up like any other copy. Invalidated (falls back to
`null`) if another point gets added to the selection after saving but before the commit, or if
the selection/curves get cleared by any of the existing reset paths (Clear All, color-count
change, canvas resize) - all of which already reset `pendingOriginPatternId` alongside what they
already reset.

### Step 9 — nails/nails+strings PNG export, graph-paper toggle (✅ implemented, freestyle only)

Scoped with a round of clarifying questions: PNG only (not the originally-brainstormed PDF/JPEG -
superseded by the user's own spec this round), white background with solid black nail dots for
both exports (the editor's own near-black `background(12)` doesn't print well onto a physical
board template) - the second export layers the real per-curve palette colors for the strings, not
plain black, on top of that same white background; control points drawn **wider** than the
in-between "inner" points, per the ask. Bundled in the same round: a small, unrelated toggle for
the existing graph-paper backdrop (step 2's "foaie de calcul" feature) - on-screen visibility only,
confirmed **not** to affect either export (a clean nails-only/nails+strings template either way,
regardless of whether the grid happens to be showing while editing).

- **"Control points" vs. "inner points":** control points are `curve.points` - what you actually
  clicked (or a pattern's own points, translated when stamped). Inner points are the physical nail
  positions the weave math itself subdivides *between* each consecutive pair of them (`segments`
  = that curve's own `colors.length`, same coupling used everywhere else) - real nails on the
  physical board, just not ones you placed directly, hence styled smaller/less prominent. The pure
  `nailPositionsForCurve` in the new `src/core/nailPositions.js` computes both sets for one curve;
  every `{from, to}` pair the weave ever draws starts/ends on one of these points, so this is
  exactly the full physical nail set, no more, no less.
- **Two buttons, freestyle only:** "Export Nails (PNG)" (`handleExportNails` →
  `ExportRenderer.renderNails`) and "Export Nails + Strings (PNG)" (`handleExportNailsAndStrings` →
  `ExportRenderer.renderNailsAndStrings`) - not added to the grid tool's menu.
- **What gets exported:** every committed curve, plus the in-progress selection if it's far enough
  along to render as a curve (`#curvesForExport`) - matches exactly what the draw loop itself
  shows, a faithful "what you see" snapshot, not just what's been formally committed via Reset.
- **Export resolution:** the canvas's own pixel size, unscaled - no separate "print DPI" needed,
  since the canvas's pixel dimensions are already calibrated to the real-world size via the
  existing DPI setting (`units.js`) - exporting 1:1 *is* exporting at that DPI.
- **Rendering approach:** a `p5.Graphics` offscreen buffer (`createGraphics`), not the visible
  canvas - `StringArtRenderer`/`CanvasView`/`GraphPaperRenderer` all draw via *bare* global p5
  calls (`stroke()`, `line()`, ...), which in p5's global mode always target the visible canvas;
  there's no way to redirect one at an offscreen buffer. `ExportRenderer` calls the buffer's own
  instance methods (`pg.stroke()`, `pg.line()`, ...) instead - but still shares the real geometry
  (`weaveSegmentsForCurve`, `nailPositionsForCurve`) with the live renderer, so only the "which
  drawing calls" part is duplicated, not any math. Downloaded via the new, small
  `src/io/PngFile.js#downloadCanvasPng` (`canvas.toBlob` + object URL + a clicked `<a>`, mirroring
  `JsonFile.js#downloadJson`'s existing pattern).
- **Refactor along the way:** `weaveMath.js` grew `weaveSegmentsForCurve(points, strokes,
  segments)` - the pure `{from, to, color}` flattening `StringArtRenderer.drawCurve` already did
  inline, pulled out so `ExportRenderer` doesn't duplicate the nested triplet/layer loop, only the
  final draw call. `StringArtRenderer.drawCurve` itself is now a thin wrapper over it - same output,
  confirmed via the existing/expanded `weaveMath.test.js`.
- **Foaie de calcul toggle:** a checkbox in the main menu (`toggleGraphPaperInput` →
  `FreestyleApp#showGraphPaper`, defaults on - today's only behavior) shows/hides
  `GraphPaperRenderer` while editing. Both PNG exports call `ExportRenderer` directly and never
  touch `GraphPaperRenderer` at all, so the grid never appears in an export regardless of the
  toggle's state.

#### New files

`src/core/nailPositions.js` (+test), `src/freestyle/ExportRenderer.js`, `src/io/PngFile.js`.

### Still to be scoped (later steps, in backlog order)

Item 7's arrow-key nudging is still open; item 9's PDF format (superseded by PNG this round, per
the user's own spec) was never pursued. No further backlog items remain unscoped as of this step.

## Working agreement for this epic

- One backlog item at a time. Each gets its own round of clarifying questions before any code
  is written, then its own implementation + verification pass (matching how the grid tool's
  refactor was verified — unit tests for pure logic, a scripted browser pass for the real
  behavior).
- This doc is the living index for the epic; expect it to grow a "## Decisions" section (and
  possibly split into per-feature docs under `docs/`) as each item gets scoped.
- Related: [overview.md](overview.md) (what the existing grid tool does and why),
  [refactor.md](refactor.md) (the current `src/` architecture this epic will build on top of).
