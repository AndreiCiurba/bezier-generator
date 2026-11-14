# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A browser-based **string-art design tool** (package.json calls it a "string-art grid planning
tool"). Despite the repo name "bezier-generator", **there is no bezier/spline math anywhere in the
code** — curves are straight-line string-art "weaves" fanned between grid nails (see Architecture
below). It was originally built as a personal planning tool for a real physical multi-color
string-art board; see `docs/overview.md` for the full history and rationale.

Three independently-served static pages share most of `src/`:
- `/` (`index.html` → `src/app/bootstrap.js`) — the original nail-grid tool.
- `/freestyle/` (`freestyle/index.html` → `src/freestyle/bootstrap.js`) — same curve/pattern/color
  mechanics on a gridless, real-world-unit (cm/mm/DPI) canvas for planning an actual physical board.
- `/3d/` (`3d/index.html` → `src/three-page/bootstrap.js`) — a Three.js 3D visualizer of the board.

**No build step for the app itself.** Plain ES modules loaded directly by each HTML page; p5.js
(1.6.0) and Three.js (r0.180.0) are pinned CDN scripts/import maps, not bundled dependencies.
Deployed as-is to GitHub Pages.

## Commands

- `npm test` — run the full Vitest suite (`vitest run`).
- `npx vitest run <path>` — run a single test file, e.g. `npx vitest run src/state/StrokePalette.test.js`.
- No lint/format config and no CI workflow exist in this repo.
- `tools/reel-pipeline/` is a separate Node project (own `package.json`, Puppeteer + ffmpeg-static)
  for headlessly rendering the `/3d` and `/cardioid` pages into vertical MP4 clips — not part of the
  zero-build app. See `tools/reel-pipeline/README.md` for its own commands.

## Reel content pipeline

`node tools/reel-pipeline/reels.mjs` (`ideas` / `sheets` / `batch` / `finish`) is the daily
social-content routine: an agent drafts a batch of candidate reels as recipe JSON files, renders
captioned previews and a review page, and the picked ones are finished at full size. Design:
`docs/epic-reel-content-pipeline.md`; commands and recipe format: `tools/reel-pipeline/README.md`.

- **Reel work runs on Opus 5.5 at medium effort.** This is a standing instruction: whenever a
  reel batch is produced or picks are finished, hand it to the matching subagent
  (`.claude/agents/reel-batch.md`, `.claude/agents/reel-finisher.md`) with model `opus` and effort
  `medium`, rather than doing it in the main session. The scheduled run
  (`tools/reel-pipeline/schedule/run-daily.ps1`) passes `--model claude-opus-5-5 --effort medium`.
- **A message beginning "Finish reels from batch ..."** (copied from a batch's review page) goes to
  the `reel-finisher` subagent, whose instructions are `tools/reel-pipeline/agents/finish-picks.md`.
- A request to make a batch goes to the `reel-batch` subagent, whose instructions are
  `tools/reel-pipeline/agents/daily-batch.md` (the same prompt the scheduled run uses). The
  channel's taste lives in `tools/reel-pipeline/STYLE.md`.
- Rendering reels with headless Chrome is the pipeline doing its job, not browser verification —
  the `no-e2e` rule does not stop `reels.mjs` from running.
- In-app half: `src/cardioid/CardioidReel.js` (Three.js) + `src/cardioid/cardioidReelFrame.js`
  (pure timeline math), exposed as `window.__reelTimeline` only under `/cardioid/?reel=1`.

## Architecture

### Curve creation is straight-line weaving, not bezier curves

The engine lives in `src/core/weaveMath.js`. For every consecutive **triplet** of user-placed
points `(p1, p2, p3)`, and for each enabled color layer, `computeWeaveSegments` subdivides edges
`p1→p2` and `p2→p3` into N points each and fans straight lines between them — layer 0 fans
straight across, each later layer shifts the connection by one step. That's the entire "curve":
many straight string segments whose envelope looks curved (classic string-art curve stitching).
`weaveSegmentsForCurve(points, strokes, segments)` flattens a whole curve into a flat list of
`{from, to, color}` segments — the single shared source of truth every renderer consumes (2D
canvas, PNG export, and the 3D Three.js scene all call the *same* function, so a curve looks
identical across pages by construction).

### Data flow: grid → selection → curve → render

1. `src/core/Grid.js` builds the nail lattice (`standard`/`rotated`/`square`/`hexagon` layouts) and
   does nearest-nail lookup. `src/core/DeformableGrid.js` + `src/core/deformation/puppetWarp.js`
   optionally let the user drag "pins" to warp nail positions — curves always render from current
   (possibly deformed) positions, never the original lattice.
2. User clicks/drags snap to the nearest nail and accumulate in `src/state/SelectionStore.js`
   (in-progress, uncommitted points). Each frame renders a live preview via `StringArtRenderer`.
3. On commit, the point list + a `StrokePalette` snapshot become a `src/models/Curve.js` (points,
   color layers, optional `patternId`, weight, visibility) pushed into `src/state/CurveStore.js`.
4. `src/models/Pattern.js` + `PatternStamper.js` (`src/app/`) / `FreestylePatternStamper.js`
   (`src/freestyle/`) are the "reuse a shape" path: translate (and optionally flip) a saved point
   set onto a new anchor nail, re-snap every point to a real nail, and drop the stamp if any point
   misses — either at one clicked nail (Manual) or every nail at once (Auto).
5. Rendering reads curves back out through `src/core/DesignModel.js`, the renderer-agnostic
   boundary both the 2D page and the 3D `SceneSync` consume — so there is no separate 3D curve
   representation. 2D: `StringArtRenderer.js` (live canvas) / `ExportRenderer.js` (offscreen PNG
   export) draw `weaveSegmentsForCurve` output with bare p5 `line()` calls. 3D:
   `src/three-page/SceneSync.js` bakes each color layer's world-Y height
   (`src/core/curveZLayers.js`) into the same segment data and builds fat `LineSegments2` lines;
   nails are `InstancedMesh` cylinders. `src/core/nailPositions.js` derives the actual physical
   nails a curve's weave touches, for PNG/3D nail exports.

### State pattern

Every class in `src/state/` (`CurveStore`, `SelectionStore`, `StrokePalette`, `PatternStore`,
`FavoritesStore`, ...) is a small ES class with private fields and an `onChange(listener)` /
`#notify()` pub-sub pair — no central store or framework. `src/ui/` classes hold no state of their
own; they only bind DOM to these stores. Screen↔world coordinate conversion happens in exactly one
place, `src/core/Viewport.js`.

### `src/core/keyframe.js` is not curve keyframing

It's a pure, dependency-free numeric/color interpolation utility (`interpolateNumber`,
`interpolateColor`, `resolveEasing`, a deterministic `wobble` noise function) used only by
`src/three-page/ReelTimeline.js` to animate *scene parameters* — camera orbit, palette colors,
nail height, deformation-pin position — over a clip's timeline for the `tools/reel-pipeline/`
headless video capture feature (active behind `/3d/index.html?reel=1`, exposing
`window.__reelTimeline`). Curve *geometry* itself is never keyframed or tweened.

### Directory map

- `src/core/` — pure geometry/rendering engine, no app state, mostly p5/DOM-free (this is what
  makes it unit-testable): `Point`, `Grid`, `Viewport`, `weaveMath`, `StringArtRenderer`,
  `CanvasView`, `DesignModel`, `DeformableGrid`, `ExportRenderer`, `nailPositions`, `curveZLayers`,
  `keyframe`, plus `deformation/puppetWarp.js`.
- `src/models/` — `Curve.js`, `Pattern.js`, `Pin.js`: plain data + the operations that make sense on it.
- `src/state/` — mutable app state, one concern per class, pub-sub as described above.
- `src/ui/` — DOM wiring only, reads/writes the state classes.
- `src/app/` — grid-page orchestration (`App.js`, `bootstrap.js`, `PatternStamper.js`).
- `src/freestyle/` — freestyle-page-specific logic (units, graph paper math, line alignment, its own bootstrap).
- `src/three-page/` — the 3D page: `ThreeApp.js` (big orchestrator), `SceneSync.js` (the only
  Three.js-owning module), `ReelTimeline.js`, `boardControls.js`, `axisMapping.js`, grid/nail-height
  UI, etc.
- `src/io/` — shared JSON/PNG export-import helpers.
- `src/data/` — curated color data.
- `css/` — stylesheets shared across all three pages.
- `docs/` — living documentation; `docs/overview.md` is the best starting point and already has a
  full module map + data-flow walkthrough. Convention: each new feature gets a paired "epic" +
  "progress" doc.
- `tools/reel-pipeline/` — standalone Puppeteer/ffmpeg pipeline that drives `/3d`'s `ReelTimeline`
  frame-by-frame to render MP4 clips; independent `package.json`, not part of the deployed app.

### Testing convention

Every stateful or pure class colocates its `*.test.js` immediately next to it (not a `__tests__`
directory) — this is a strict, repo-wide convention. Tests use Vitest (`describe`/`it`/`expect`),
full-sentence `it(...)` names explaining *why* a behavior exists (not just what it does), and plain
`toEqual`/counter-based assertions rather than mocking libraries.

## Standing rules already enforced

Two project skills change default behavior and are already active — no need to ask before
following them: **`no-e2e`** (don't spin up Playwright/Chromium browser verification unless the
current request explicitly asks for it) and **`no-push`** (never `git push` or open a PR unless
explicitly asked). A third, **`nail-grid-defromation`**, documents the local-only workflow for
generating a deformed nail grid from a reference image.
