# Bezier / String Art Grid — Project Overview

Live deploy: https://andreiciurba.github.io/bezier-generator/

## What it is

A browser-based **string-art design tool** built on [p5.js](https://p5js.org/) (loaded via CDN,
no build step / no package.json — plain ES modules loaded straight from `index.html`).

It renders a grid of "nails" (points) arranged in a triangular/rotated lattice. The user clicks
points to build a path (a "curve"), and for every consecutive triplet of points the app draws a
web of straight lines between them (an approximation of string art / Bezier curve stitching),
each line colored from a user-defined palette. Finished curves persist on the canvas ("stored
curves") and can be turned into reusable, stamped "patterns."

## History / original intent

The code itself only shows a generic drawing tool, but the full commit history (not just the
current tip) makes the original goal much clearer: **this was built as a personal planning tool
for making a physical, multi-color string art piece** — not a generic art app.

- **`e91037f feature: setup string art generator`** — the very first commit, named exactly that.
- **`fix(BZ-1): change grid size to match current project`** — "match current *project*" implies
  a real physical board exists somewhere with specific nail spacing, and the on-screen grid was
  tuned to mirror it 1:1 — a planning surface for something actually being built with nails and
  thread, not a toy generator.
- **`feat(BZ-2): expanded colors to match any size`** → **`feat(BZ-6): option to enable color
  tier`** → **`fix(BZ-6): right click instead of ctrl click to toggle color tiers`** — the
  per-color enable/disable toggle (now in `src/ui/ColorPickerUI.js`) matches how string art is
  actually built physically: string every color-1 thread across the whole board first, then hide
  color 1 and move on to color 2, etc.
- **`functional patterns v1`** → **`layered patterns v2`** → **`pattern type toggle
  (Manual/Auto)`** — the pattern save/stamp system reads as a way to build a large repeating or
  symmetric design (a mandala-like or tiled geometric piece) without manually re-clicking the same
  nail sequence dozens of times across a big board.
- **`bugfix: make it work for mobile`** — cared about phone usability, i.e. likely referenced
  live while standing at the physical board stringing thread, not only while designing at a desk.
- **`chore: add tracking code for analytics`**, deployed at `andreiciurba.github.io/bezier-generator`
  — shared/published publicly, not just a local script.
- **`fix: don't change pattern colors`** (the commit right before this doc was started) — froze a
  stamped pattern copy's colors once drawn, so later tweaks to the live color pickers stop
  retroactively repainting copies already placed. Consistent with "the plan is locked in, stop
  changing it under me" — i.e. finalizing a real build plan, not just experimenting.

**Working conclusion:** the goal is to design and lock in the exact nail layout, thread paths, and
color sequence for a real multi-color string-art board, with enough repeatability (patterns) and
color-layering (tiers) to make the actual physical stringing process tractable, and portable
enough to check on a phone mid-build.

## Module map

**As of 2026-08-10 the codebase was restructured into small single-purpose classes under
`src/` — see [refactor.md](refactor.md) for the full rationale, old-file→new-file mapping, and a
list of real bugs found and fixed along the way.** The description below reflects the current
structure; treat refactor.md as the detailed changelog for *why* it looks like this.

- **`index.html`** — page shell, loads p5.js from CDN, then a single entry module
  (`src/app/bootstrap.js`), plus a burger-menu UI (colors, patterns, reset/undo/clear).
- **`src/core/`** — geometry and rendering, no app state.
  - `Point.js` — a tiny p5-independent `{x,y}` class (copy/set/add/sub/distanceTo). Everything
    pure lives on top of this instead of p5's `createVector`, which is what makes it unit-testable.
  - `Grid.js` — builds the triangular lattice of nails (`standard`/`rotated` layouts) and
    `findNearestPoint(worldPos, maxDistance)` — a real nearest-neighbor search (returns `null`
    if nothing is close enough) rather than the original's "first point found within 10px".
  - `Viewport.js` — pan/zoom camera; the single place screen↔world conversion happens.
  - `weaveMath.js` — pure math for the string-art "weave" fan between three nails.
  - `StringArtRenderer.js` — draws a curve using `weaveMath`, one stroke layer at a time.
  - `CanvasView.js` — grid dots, the in-progress selection guide line, and the floating
    pattern-shape preview shown while hovering a saved pattern.
- **`src/models/`** — plain data with the operations that make sense on it.
  - `Curve.js` — one woven curve on the canvas: points + colors + which pattern (if any) it
    came from, and whether it's "locked" against further live recoloring.
  - `Pattern.js` — a named, reusable curve shape; `translatedTo(anchor)` is pure geometry.
- **`src/state/`** — the app's mutable state, one concern per class.
  - `StrokePalette.js` — the 8 color slots (each `{color, enabled}`).
  - `CurveStore.js` — curves committed to the canvas (add/undo/clear/lookup by pattern).
  - `SelectionStore.js` — the in-progress manual point selection.
  - `PatternStore.js` — saved patterns, the active selection, and Manual/Auto placement mode.
  - `FavoritesStore.js` — saved color-palette bundles.
- **`src/ui/`** — DOM wiring only; reads/writes the state classes above, holds no state itself.
  - `Panel.js` / `MenuUI.js` — generic show/hide panel + the burger/main-menu swap.
  - `ColorPickerUI.js` — the 8 color inputs: left-click changes color, right-click toggles enabled.
  - `FavoritesUI.js` — the Colors submenu (save/export/import bundles, click-to-apply).
  - `PatternUI.js` — the Patterns submenu (save/export/import, saved-pattern list, hover preview,
    Manual/Auto toggle).
- **`src/app/`** — orchestration.
  - `PatternStamper.js` — places pattern copies onto the grid, either at one clicked nail
    (`stampAtScreenPoint`) or at every nail at once (`stampThroughoutGrid`, "Auto" mode).
  - `App.js` — owns one instance of everything above; implements p5's lifecycle callbacks
    (`setup`/`draw`/`mousePressed`/`mouseDragged`/`mouseWheel`/`touchStarted`/`touchEnded`/...).
  - `bootstrap.js` — the one file `index.html` loads; hands `App`'s bound methods to p5's
    global-mode `window.setup`/`window.draw`/etc.
- **`src/io/JsonFile.js`** — shared "download as JSON" / "read a File as JSON" helpers, used by
  both the Colors and Patterns export/import flows.

Each pure/testable class has a co-located `*.test.js` (Vitest) — see refactor.md for how to run
them. This is dev-only tooling; the app itself is still zero-build plain ES modules.

## Data flow (typical manual session)

1. `Grid` builds its `points` in the `App` constructor.
2. User clicks nails → `App#mousePressed` finds the nearest grid point (`Grid#findNearestPoint`)
   and appends it to `SelectionStore`; each frame `StringArtRenderer` renders the live weave
   preview for those points using the current `StrokePalette`.
3. User clicks **Reset** → the curve (points + a snapshot of the palette) is pushed to
   `CurveStore` as a `Curve`, and the selection clears for the next curve.
4. Optionally, before resetting, user clicks **Save Current** in the Pattern submenu → the
   in-progress selection is saved as a named, reusable `Pattern` in `PatternStore`.
5. Selecting a saved pattern from the list switches into "pattern mode": clicking a nail (Manual)
   or one click (Auto → all grid points at once, via `PatternStamper#stampThroughoutGrid`) stamps
   translated copies of that pattern's shape into `CurveStore`, tagged with `patternId` so future
   color changes only affect curves *not yet drawn* for that pattern (`Curve#previouslyDrawn`,
   checked in `App#draw`).
6. Colors/patterns can be exported/imported as JSON for reuse across sessions (no backend — pure
   client-side, nothing persists across a page reload otherwise).

## Notable state/known rough edges (for context, not necessarily bugs to fix)

- No persistence: reloading the page loses all curves, patterns, and favorites (export/import
  JSON is the only save mechanism).
- No build tooling — raw ES modules + a p5.js CDN `<script>` tag; `uuid` is also pulled from a
  CDN (`unpkg`, now isolated to `src/utils/id.js`).
- The 2026-08-10 modularization refactor (see [refactor.md](refactor.md)) fixed several bugs
  found while restructuring the code — dead code, a broken close button, a pan/zoom stamping bug,
  and more. That doc is the changelog; nothing outstanding from that pass remains here.

## Working agreement

- This `docs/` directory is the living documentation set for the project, starting with this
  overview file.
- `docs/` ships with the code (tracked in git as of the modularization commit).
- As new features are scoped, each gets its own MD file in `docs/`.
