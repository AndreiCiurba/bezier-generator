# Epic: Freestyle page (`/freestyle`)

**Status:** Step 1 (backlog items 1, 3, 5 in cut-down form, plus the canvas-size half of item 2)
is implemented and verified. Delivered incrementally, one item at a time, each scoped with its
own round of questions before code is written.

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
- **Default canvas size:** 600×400px, centered via CSS (`position:absolute` + `transform:
  translate(-50%,-50%)` on the canvas element, in the new `css/freestyle.css`).
- **Canvas size picker:** a "Canvas Size" submenu (`CanvasSizeUI`, mutually exclusive with
  Colors/Patterns via the same `PanelGroup`) - preset dropdown (20×20, 30×30, 30×40, 40×40,
  50×50 cm, applies immediately on selection) + custom width/height text fields (accept "20cm",
  "600px", or a bare number defaulting to px; applied via an explicit Apply button) + a DPI
  number field controlling the unit→pixel ratio (default 96, i.e. ~37.8px/cm).
- **Changing canvas size:** clears curves, the in-progress selection, and the active pattern
  selection, then calls p5's `resizeCanvas` - a clean slate at the new size, as decided.
- **Patterns on freestyle:** no Manual/Auto toggle (there's no grid to auto-stamp across) -
  clicking a saved pattern arms it, then a canvas click stamps one copy anchored exactly there
  (`FreestylePatternStamper`, the no-grid counterpart to `PatternStamper`).

#### New files

`src/freestyle/`: `units.js` (+test - pure cm/mm/in↔px conversion), `CanvasSizeUI.js`,
`FreestylePatternStamper.js` (+test), `FreestyleApp.js`, `bootstrap.js`. Plus `freestyle/index.html`
and `css/freestyle.css`.

#### Shared-code changes (both backward-compatible, grid tool unaffected)

- `PatternUI`'s `toggleModeBtn` element is now optional - omitted on freestyle, still present and
  wired on the grid tool.
- The `touchesMenus` hit-test (mousePressed/touchEnded, "did this click land on a menu instead of
  the canvas") was pulled out of `App.js` into `src/ui/menuHitTest.js` so `FreestyleApp` doesn't
  duplicate it. It generically checks `.closest('.panel')`, so it needed no per-submenu ID list
  and required no change when the Canvas Size submenu was added.

#### A bug caught during verification

`#canvasSizeSubmenu` was initially missing from the CSS selector that positions submenus beside
the main panel (`#colorFavoritesSubmenu, #patternSubmenu { position: absolute; ... }`) - it fell
back to rendering as a normal in-flow child inside `#ui`, stacking on top of and blocking
`#closeUiBtn`. Caught by the Playwright verification pass (a real click timeout, not a visual
guess) and fixed by adding `#canvasSizeSubmenu` to that selector.

### Still to be scoped (later steps, in backlog order)

Items 2 (unit conversion beyond the canvas-size input), 4 (color count), 6 (hover/grey-out
display), 7 (keyboard-driven pattern placement), 8 (drag-and-drop point editing), 9 (export) —
each gets its own clarifying round when we get to it.

## Working agreement for this epic

- One backlog item at a time. Each gets its own round of clarifying questions before any code
  is written, then its own implementation + verification pass (matching how the grid tool's
  refactor was verified — unit tests for pure logic, a scripted browser pass for the real
  behavior).
- This doc is the living index for the epic; expect it to grow a "## Decisions" section (and
  possibly split into per-feature docs under `docs/`) as each item gets scoped.
- Related: [overview.md](overview.md) (what the existing grid tool does and why),
  [refactor.md](refactor.md) (the current `src/` architecture this epic will build on top of).
