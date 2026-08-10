# Refactor: modular architecture (2026-08-10)

The app was originally built feature-by-feature under real time pressure (see
[overview.md](overview.md)'s "History / original intent") with no particular
attention to structure - most state lived as `export let` module globals that
any file could import and mutate directly, DOM wiring and business logic were
interleaved in the same functions, and a few things were duplicated
copy-paste style. This refactor restructures it into small, single-purpose
classes without changing the toolchain: still zero-build, plain ES modules,
p5.js loaded globally via CDN, deployed to GitHub Pages exactly as before
(just pointed at a new entry file - see "What changed for deployment" below).

## New layout

```
src/
  core/       Grid, Viewport, Point, weaveMath, StringArtRenderer, CanvasView
              - the geometry and rendering engine. Point/Grid/weaveMath have
                zero dependency on p5 or the DOM, which is what makes them
                unit-testable.
  models/     Curve, Pattern
              - plain data + the (pure) operations that make sense on that data.
  state/      StrokePalette, CurveStore, SelectionStore, PatternStore,
              FavoritesStore
              - the app's mutable state, each concern in its own class instead
                of one shared bag of module-level exports.
  ui/         Panel, MenuUI, ColorPickerUI, FavoritesUI, PatternUI
              - DOM wiring only. These bind state classes to elements; they
                don't hold logic of their own beyond that binding.
  app/        App, PatternStamper, bootstrap
              - App owns one instance of everything above and implements p5's
                lifecycle callbacks (setup/draw/mousePressed/...). bootstrap.js
                is the one file index.html loads; it just hands App's bound
                methods to p5's global-mode `window.setup`/`window.draw`/etc.
```

Every `*.test.js` file sits next to the module it tests (Vitest convention).
Run them with `npm install && npm test`.

### Old file → new home

| Old | New |
|---|---|
| `grid.js` | `src/core/Grid.js` (+ `Point.js`) |
| `bezier.js` | `src/core/weaveMath.js` (pure math) + `src/core/StringArtRenderer.js` (p5 drawing) |
| `interactions.js` | `src/state/SelectionStore.js` + drawing moved to `CanvasView.drawGuidePath` |
| `colors.js` + `src/listener/color.js` | `src/state/StrokePalette.js` + `src/state/FavoritesStore.js` + `src/ui/ColorPickerUI.js` + `src/ui/FavoritesUI.js` |
| `pattern.js` | `src/models/Pattern.js` + `src/state/PatternStore.js` + `src/ui/PatternUI.js` + `src/app/PatternStamper.js` |
| `main.js` | `src/app/App.js` + `src/app/bootstrap.js` + `src/ui/MenuUI.js` |

## Design principles applied

- **State stores own their data; UI classes don't hold state of their own.**
  Every `ColorPickerUI`/`FavoritesUI`/`PatternUI` method reads from and writes
  to a store (`StrokePalette`, `FavoritesStore`, `PatternStore`, ...) rather
  than keeping its own copies. That's what the original's scattered
  `export let` module globals were really trying to be.
- **Pure geometry has no p5/DOM dependency.** `Point`, `Grid`, `weaveMath`,
  and `Pattern#translatedTo` only ever touch plain numbers - no
  `createVector`, no canvas calls. That's what let them get real unit tests
  instead of only being checkable by clicking around in a browser.
- **One conversion, one owner.** Screen→world coordinate conversion happens
  in exactly one place (`Viewport`) and is called once per interaction - see
  the pan/zoom bug below, which existed because the original converted twice.
- **JSON export/import mechanics are shared** (`src/io/JsonFile.js`) instead
  of two near-identical copies in colors.js and pattern.js; only the
  domain-specific validation stayed with each caller.

## Bugs found and fixed along the way

These came out of the "known rough edges" pass agreed on with the user
alongside the modularization - all were either already-broken behavior or
provably-inert code, not new risk introduced by moving files around:

1. **`previoulsyDrawn`/`previouslyDrawn` typo** (fixed earlier, before this
   refactor started) - two different spellings meant the "freeze a stamped
   pattern's colors after first render" mechanism only worked by accident.
2. **Nearest-point snapping picked the *first* grid point within 10px, not
   the nearest one**, and threw if none qualified. `Grid#findNearestPoint`
   now does a real nearest-neighbor search and returns `null` safely - see
   `Grid.test.js`.
3. **Pattern stamping double-applied the pan/zoom conversion.** main.js
   converted a click to world space, then passed that *already-converted*
   point into `renderPattern`, which converted it again internally. Stamped
   patterns landed in the wrong place any time the canvas had been panned or
   zoomed. `PatternStamper#stampAtScreenPoint` now takes a raw screen point
   and does the single canonical conversion - see `PatternStamper.test.js`'s
   pan/zoom case.
4. **The Colors submenu's "X" close button had two listeners racing on the
   same element** (a copy-paste mismatch - `colorBurgerBtn` and
   `closeColorSubmenuBtn` were the same DOM node), which canceled each other
   out and left the button not actually closing the panel. Verified fixed
   end-to-end (Playwright): clicking it now hides the panel.
5. **The color pickers had two separate, redundant `'input'` listeners**
   (one in colors.js, one in src/listener/color.js) doing the same
   assignment. `ColorPickerUI` wires it once.
6. **`renderFavoriteBundles` attached the same click handler once per color
   in a bundle** (so an 8-color bundle got 8 stacked listeners on one `div`),
   which happened to still apply the whole bundle correctly only because each
   listener closed over a different color/index - fragile, and confusing to
   read. `FavoritesUI#applyBundle` now does the equivalent in one explicit
   listener that loops the bundle.
7. **Touch support looks like it never worked.** `touchStarted` assigned to
   `touchStartTime`/`touchStartX`/`touchStartY` without declaring them
   anywhere. ES modules are strict-mode by default, so that assignment would
   throw `ReferenceError`, not silently create globals. They're now real
   `App` instance fields.
8. **Dead code removed:** `drawBezierCurve` and `generateZigzagFromGrid` from
   the original bezier.js - neither was reachable from any UI control.
9. Escape's handler called the Reset button's logic *and then* separately
   repeated the exact same two state assignments it had just made
   (`setSelectedPatternId(null, false)`) - redundant, removed.

None of these change what a correctly-used session looks like today, except
(3) and (4), which were outright broken before and now work.

## What changed for deployment

`index.html` now loads a single `<script type="module" src="src/app/bootstrap.js">`
instead of seven separate top-level scripts. GitHub Pages still serves the
repo root directly with no build step - nothing else about deployment
changes.

`package.json` was added, but only for `vitest` as a dev dependency to run
the unit tests locally. The app itself still ships as plain files; there is
no build/bundle step and nothing in `package.json` runs in production.
