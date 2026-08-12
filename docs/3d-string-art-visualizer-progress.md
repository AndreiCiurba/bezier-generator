# 3D string art visualizer epic — progress tracker

One slice at a time, as agreed. This file is the running checklist; see
[3d_string_art_visualizer_epic.md](3d_string_art_visualizer_epic.md) for the full backlog wording,
Step 1–11 breakdown, and Definition of Done, and the approved plan
(`docs-3d-string-art-visualizer-epic-md-co-sharded-piglet.md` under the Claude plans folder) for the
concrete design/rationale behind each decision below.

## Scoping decisions (confirmed before any code was written)

- **Data source: the main grid page's design** (`Grid`/`DeformableGrid`/`CurveStore`/`PatternStore`/
  `StrokePalette`/`PatternStamper`, `src/app/App.js`) — not freestyle's. Freestyle has no nail grid or
  deformation at all; "similar to freestyle" is read as a structural precedent (own page, own
  bootstrap, shared `src/` modules), not a data-model match.
- **Full epic scope**, including in-3D Drawing Mode — not a view-only inspector.
- **New shared curve-visibility toggle**, not a 3D-only one — the epic assumes an "existing Z-layer
  visibility toggle" that doesn't actually exist anywhere in the codebase yet. Built for real, wired
  into the 2D grid page too, so both renderers read one source of truth.
- **The `3d/` page owns its own independent instances** of `Grid`/`DeformableGrid`/`CurveStore`/
  `PatternStore`/`StrokePalette` (same default `GRID_CONFIG` as `App.js`) — matching the existing `/`
  ↔ `/freestyle` precedent (separate app instances sharing code, never live cross-tab state). Not a
  live mirror of whatever's open in the `/` tab.
- **One slice per round**, each with its own implementation + verification pass before moving to the
  next (matching how the freestyle/deformation epics were built) — the user stops/resumes progress
  between slices explicitly.

## Slices

- [x] **Slice 0 — Shared design model + curve visibility (2D only)** (Step 1 of the epic)
      `src/core/curveZLayers.js` (+test) — pure Z-layer distribution math (`normalizedZLayer`/
      `worldZLayer`, open-interval so curves never sit exactly on the board or nail plane).
      `src/core/DesignModel.js` (+test) — thin read-through over `DeformableGrid`+`CurveStore`:
      `.nails` (id = array index, current/deformed position), `.curves`/`.visibleCurves`
      (`zLayerIndex`/`zLayerCount` derived from *full* store order, so hiding a curve never
      reshuffles another curve's Z slot). `src/models/Curve.js` — added `id` (local counter, same
      pattern as `Pin`'s `generatePinId`) and a `visible` 5th constructor param, default `true`, so
      every existing call site is unaffected. `src/state/CurveStore.js` — added `onChange`/
      `setVisible(curveId, visible)`/`visibleCurves`, all mutators (`add`/`undo`/`clear`/
      `setVisible`) now notify; `setVisible` is the *only* sanctioned way to flip a curve's
      visibility. `App.js` — constructs `this.design = new DesignModel(...)`; the `draw()` curve
      loop and `#curvesForExport()` now iterate `this.design.visibleCurves` instead of
      `this.curves.curves` directly, so hidden curves are skipped by both on-screen rendering and
      PNG export. New `src/ui/CurvesUI.js` — a "Curves" submenu list (modeled on `PatternUI`'s
      saved-pattern list), one checkbox per committed curve, auto-refreshes via
      `curveStore.onChange` (so `Reset`/`Clear All`/`Undo`/color-count-change already refresh it for
      free, no extra wiring needed at those call sites). `index.html`/`css/styles.css` — new
      `#curvesSubmenu` panel + `#openCurvesBtn`, registered into the existing submenu group/position
      selector. Scope: 2D grid page + shared classes only — `freestyle/index.html`/`FreestyleApp.js`
      untouched (backward-compatible defaults). Full `vitest run`: 31 files / 213 tests passing.
- [x] **Slice 1 — 3D page skeleton + Three.js scene foundation** (Step 2)
      `3d/index.html` — new page, no p5 `<script>` at all, Three.js loaded via a version-pinned
      import map (`three@0.180.0`, jsDelivr — `three.module.js` + `examples/jsm/` addons, URLs
      verified live), `<script type="module" src="../src/three-page/bootstrap.js">`. New
      `src/three-page/` module: `bootstrap.js` (no p5 lifecycle to bridge into - just
      `new ThreeApp().init()`), `ThreeApp.js` (scene/`PerspectiveCamera`/`WebGLRenderer`/
      `OrbitControls` - Three's own, not custom camera math, matching the epic's own instruction -
      /ambient+directional lighting/`resize` handling/render loop, plus a placeholder test cube so
      "Three.js renders successfully" is visible before the board/nails/curves land in later
      slices). `axisMapping.js` (+test) — pure 2D↔3D coordinate mapping (`to3D`/`fromWorld3`), zero
      `three` import so it stays trivially unit-testable; documents the axis-mapping decision (board
      flat on XZ, height on Y-up) that later slices' board/nail/Drawing-Mode-camera code will all
      build on. New `css/three-page.css` — full-viewport canvas (not the p5 pages' small centered
      fixed-size canvas from `canvas-frame.css`, which doesn't fit an orbit/pan/zoom 3D scene).
      `.page-nav-link` refactored into a `.page-nav` flex wrapper (was a single `position:fixed`
      link, couldn't stack two) so every page now cross-links to *both* others: `index.html` →
      Freestyle + 3D, `freestyle/index.html` → Grid + 3D, `3d/index.html` → Grid + Freestyle. Full
      `vitest run`: 32 files / 217 tests passing. Manual verification (real WebGL render, orbit/pan/
      zoom, resize) not yet run — per the `no-e2e` skill, only on explicit request.
- [x] **Slice 2 — Board rendering** (Step 3)
      `ThreeApp.js` now owns its own `Grid` instance (same default `GRID_CONFIG` as `App.js`'s grid
      tool - own independent instance, not a live mirror, per the stated assumption above). New
      `src/three-page/SceneSync.js` — the file that owns every `THREE.*` object; builds the board as
      a `BoxGeometry`/`MeshStandardMaterial` mesh sized from `grid.boundingBox()` + the same
      padding convention as `App.js`'s `GRID_PADDING`, top surface pinned to world `Y = 0`
      (`BOARD_TOP_Y`) so nails/curve layers added in later slices have a fixed reference plane.
      Also owns `toWorldPosition`/`toDesignPosition` — combines `axisMapping`'s pure axis remap with
      a centering origin (grid bounding-box center → world X/Z = 0), the one shared transform every
      later slice (nails, curves, Drawing Mode raycasting) will reuse rather than each computing its
      own offset. Thickness changes dispose + rebuild the box geometry; color changes are a cheap
      `material.color.set(...)`, no rebuild — `setBoardThickness`/`setBoardColor` guard accordingly.
      `boardControls.js` (+test) — pure `parseBoardThickness`/`parseBoardColor` validation, same
      style as `pinParams.js`/`strokeWeightSetting.js`. New `src/three-page/BoardControlsUI.js` —
      thickness is a field+Apply (mirrors `StrokeWeightUI`); color is a native
      `<input type="color">` applying live on `input` (no Apply button needed, matches
      `ColorPickerUI`'s live-apply swatches). `3d/index.html` — first burger/menu panel on this
      page (`MenuUI`, reused as-is), holding the two board fields; more controls will accumulate
      here in later slices. Full `vitest run`: 33 files / 221 tests passing. Manual/visual
      verification not yet run — per the `no-e2e` skill, only on explicit request.
- [x] **Slice 3 — 3D nail grid** (Step 4)
      **Scope change requested mid-slice** (confirmed via a quick round of questions): the grid is
      always **square** (N×N), not the 2D grid tool's fixed 15×13 rectangle, and its size is
      **user-selectable** - preset dropdown (9/11/13/15/17, applies immediately) + a custom-N field
      + Apply, default 13×13, mirroring freestyle's `CanvasSizeUI` shape exactly. New
      `src/three-page/gridSize.js` (+test, pure `parseGridSize`/presets) and `GridSizeUI.js`. Same
      equidistant/rotated-layout generation as the 2D `Grid` class either way - only N changed, not
      the math. `ThreeApp.js` now also owns a `DeformableGrid` wrapping its `Grid` (zero pins, no
      deformation UI yet - that's Slice 7 - but nails already read through `deformation.points`, so
      wiring real Puppet Warp later needs no change here). `SceneSync.js` — nails render as one
      `THREE.InstancedMesh` (a single draw call regardless of grid size); each nail is a unit-height
      cylinder geometry pre-translated so its base sits at local Y=0, stretched per-instance via a
      Y-axis matrix scale to the current nail height - so height changes only rewrite the
      instance-matrix buffer, never rebuild geometry. `setGrid(grid, deformation)` fully rebuilds
      board+nails when N changes (both footprint and nail count change); a `TODO`-style comment
      marks where a future `CurveStore` will get cleared on resize too, once Slice 4 adds one (per
      the confirmed decision: grid-size changes clear the design, matching the 2D app's existing
      canvas-size/color-count-change convention). New `src/three-page/nailHeight.js` (+test) +
      `NailHeightUI.js` (field+Apply, mirrors `StrokeWeightUI`) for the global nail-height control.
      `3d/index.html` gained a "Grid Size" submenu (first submenu on this page - `submenuGroup`
      introduced in `ThreeApp` now, ready for later slices' Deformation/Curves/Patterns/Colors
      submenus to register into) plus direct Nail Height field. Full `vitest run`: 35 files / 227
      tests passing. Manual/visual verification not yet run — per the `no-e2e` skill, only on
      explicit request.

      **Follow-up (same slice): real-nail silhouette.** The single uniform-radius peg was replaced
      with a slim shaft + a noticeably wider, flatter head - two `CylinderGeometry`s
      (`SHAFT_RADIUS=2`/`HEAD_RADIUS=6`, shaft = bottom 85% of the height) merged into one
      `BufferGeometry` via `three/addons/utils/BufferGeometryUtils.js#mergeGeometries` (already
      covered by the existing `three/addons/` import-map prefix, no HTML change needed), so each
      nail still costs exactly one `InstancedMesh` draw call. Both radii live in the same
      local-unit-height space the per-instance Y-scale already stretches, so "thicker head" stays
      proportionally correct at any nail height without a geometry rebuild - the nail-height-change
      cost model from Slice 3 is unchanged.
- [x] **Slice 4 — Curve/string Z-layer rendering** (Steps 5–6)
      `ThreeApp.js` now owns its own `CurveStore`/`StrokePalette`/`DesignModel` (independent
      instances, same "not a live mirror" reasoning as `Grid`/`DeformableGrid`) - `DesignModel` is
      handed into `SceneSync` as the one shared read-through boundary for curve
      ordering/visibility/Z-layers (the same class the 2D page's `App.js` already consumes since
      Slice 0). `SceneSync.js` renders one `LineSegments2` per curve, built from the unmodified,
      shared `weaveSegmentsForCurve` (`src/core/weaveMath.js`) - identical geometry to the 2D page,
      no new weave math. Uses the "fat line" addon (`LineSegments2`/`LineSegmentsGeometry`/
      `LineMaterial` from `three/addons/lines/*`, already covered by the existing `three/addons/`
      import-map prefix) instead of native `THREE.LineSegments`, whose ~1px width cap (most desktop
      GPU/driver combos) can't deliver visible individual colored strands or vertical layer
      separation from an oblique angle - confirmed via the actual shipped source
      (`USE_COLOR`/`instanceColorStart`/`instanceColorEnd` in `LineMaterial.js`/
      `LineSegmentsGeometry.js`) that `vertexColors: true` + `geometry.setColors(...)` is the correct
      way to keep each segment's own color, verified by reading the real addon files rather than
      assumed. Each curve's Y position is applied once as the whole object's `.position.y`
      (`curveZLayers.js#worldZLayer`, board-top exclusive to nail-height exclusive) rather than baked
      into every vertex, so a Z-layer shift (nail-height change, or curve add/undo/clear - **every**
      curve's `zLayerIndex`/`zLayerCount` shifts when the total count changes, not just the
      added/removed one) is a cheap reposition, never a geometry rebuild. `SceneSync` subscribes to
      `curveStore.onChange` once (not on every grid rebuild) and diffs against its own
      `Map<curveId, LineSegments2>` - new ids get built, stale ids (undo/clear) get disposed, every
      surviving id gets repositioned/re-shown. `LineMaterial`'s width is screen-space-pixel-based, so
      `SceneSync#setViewportSize` (called from `ThreeApp`'s existing resize handler) keeps every
      curve's line width correct after a resize. Grid-size changes now actually clear the curve store
      first (fulfills the Slice 3 TODO), before rebuilding board/nails. Reused the exact
      `src/ui/CurvesUI.js` from Slice 0 as this page's own "Curves" submenu (per-curve show/hide
      checkboxes) - no new UI class needed, just a second instance against this page's own
      `CurveStore`. **Testability note**: this slice has no way yet to create curves through the UI
      (Drawing Mode is Slice 6), so end-to-end visual verification of curve rendering waits until
      then; `CurveStore`/`DesignModel`'s own logic is already unit-tested (Slice 0), and
      `SceneSync`/`ThreeApp` stay outside the unit-test boundary (no jsdom/WebGL environment
      configured), consistent with `App.js`/`FreestyleApp.js`. Full `vitest run`: 35 files / 227
      tests passing (unchanged - no new pure logic added this slice). Manual/visual verification not
      yet run — per the `no-e2e` skill, only on explicit request.

      **Follow-up (Slice 3, same session): real-nail silhouette tuned further.** `HEAD_RADIUS`
      5 (down from 6) and `SHAFT_FRACTION` 0.97 (shaft = bottom 97%, head caps the top 3% - down
      from 85/15) - a subtler, more proportionate head after eyeballing the first cut.
- [x] **Slice 5 — Camera UX + XYZ legend** (Step 7)
      New `src/three-page/cameraFraming.js` (+test, pure, no `three` import) — `framingDistance`
      (fits a `boardWidth`×`boardDepth` rectangle's diagonal into a perspective camera's vertical
      FOV, plus padding) and `defaultCameraPosition` (scales a fixed elevated three-quarter view
      direction by that distance). Replaces the old hardcoded `INITIAL_CAMERA_POSITION` constant -
      the initial view and the new "Reset Camera" button now both call the same
      `#applyDefaultCameraView()` in `ThreeApp.js`, so they always agree, and both automatically
      re-fit whatever the board's *current* footprint actually is (grid size is user-selectable
      since Slice 3). Required reordering `init()` so `SceneSync` (and its board dimensions) exists
      before the camera is constructed. New `src/three-page/OrientationGizmo.js` — the persistent
      bottom-right XYZ legend: a tiny separate `Scene` (three colored `ArrowHelper`s + canvas-texture
      text-label sprites for X/Y/Z) with its own orthographic camera whose *rotation only* mirrors
      the main `OrbitControls` camera every frame, rendered into a scissored corner rectangle of the
      *same* `WebGLRenderer`/canvas (not a second canvas) after the main scene each frame - so it
      stays fixed to the viewport rather than moving with the 3D scene, and always shows the current
      orientation mid-orbit (a static label couldn't). **Bug caught and fixed before shipping**:
      `renderer.render()` auto-clears (color + depth) by default, which would have wiped the
      just-rendered main scene's pixels inside the gizmo's rect before drawing the gizmo itself,
      defeating the "live scene as backdrop" intent - fixed by temporarily setting
      `renderer.autoClear = false` and clearing depth only (respecting the active scissor rect)
      before the gizmo's own render call, restored immediately after. Full `vitest run`: 36 files /
      233 tests passing. Manual/visual verification not yet run — per the `no-e2e` skill, only on
      explicit request.
- [x] **Slice 6 — Drawing Mode** (Steps 8–9)
      New `src/three-page/DrawingModeCamera.js` — a locked top-down `OrthographicCamera`,
      `up=(0,0,-1)`, positioned directly above the board. That specific up vector is what makes the
      view match the *existing 2D layout* (not mirrored/rotated): verified via the standard `lookAt`
      basis derivation (not assumed) that it produces local +X = world +X, local +Y = world -Z -
      screen-right/up read as 2D-right/up exactly. Frustum fit via a new pure
      `cameraFraming.js#orthographicHalfExtents` (+test) - letterboxes/pillarboxes the board into
      whatever the actual viewport aspect is, extracted as pure math (no `three` import) specifically
      so it's unit-testable, per the plan's own suggestion for this piece. Raycasting: NDC mouse
      position → `Raycaster.ray.intersectPlane` against the board-top plane (world Y=0) →
      `SceneSync#toDesignPosition` → plain 2D point, feeding straight into the *exact same*
      `DeformableGrid#findNearestPoint`/`SelectionStore#add` calls `App.js#placeAtScreenPoint` uses
      on the 2D page - no parallel selection logic. `ThreeApp.js` now also owns a `SelectionStore`
      (in-progress curve) and reuses `ColorPickerUI`/`ColorCountUI`/`StrokeWeightUI` verbatim (same
      "shared UI class, new instance" pattern as `CurvesUI` in Slice 4) for color/weight parity with
      the 2D page. Manual curve-building buttons - Reset (commit-and-clear, same
      confusingly-named-but-consistent convention as `App.js`), Clear All, Undo, Undo Line - mirror
      `App.js`'s handlers exactly. A "Drawing Mode" checkbox toggles: on entry, saves
      `{camera.position, controls.target}`, disables `OrbitControls`, disables the (now-meaningless)
      "Reset Camera" button, switches `activeCamera` to the locked orthographic camera, and starts
      listening for canvas clicks; on exit, restores the exact saved pose (epic's "user should not
      lose their previous 3D viewpoint"), re-enables orbit controls, restores `activeCamera`. New
      curves appear immediately - `CurveStore#add` already notifies `SceneSync` (Slice 4), no new
      wiring needed for that part. Also added a live in-progress selection guide - a plain
      `THREE.Line` polyline through the points placed so far, at nail-height (`SceneSync#
      setSelectionGuide`/`clearSelectionGuide`) - not asked for explicitly but a natural/necessary
      extension of "select nails and create curves" (confirming clicks registered before committing).
      `OrientationGizmo` refactored to take the active camera as a `render()` argument instead of a
      fixed constructor reference, since there are now two cameras and only one is ever active.
      **Scope note**: pattern stamping/saved-pattern list/Favorites are intentionally *not* included
      in this slice (a materially larger UI surface - `PatternStore`/`PatternStamper`/`FavoritesUI`) -
      manual point-by-point curve building satisfies the epic's Drawing Mode acceptance criteria
      ("select nails," "create curves"); pattern stamping is a natural, clearly-scoped follow-up if
      wanted. Full `vitest run`: 36 files / 238 tests passing. Manual/visual verification (real
      click-to-place, camera lock/restore, resize while in Drawing Mode) not yet run — per the
      `no-e2e` skill, only on explicit request.
- [ ] **Slice 7 — Deformation integration verification** (Step 10)
      Confirm Puppet Warp pin drags on the 3D page's own `DeformationUI` live-update nails/strings
      through the `DesignModel.nails` read-through (expected to be mostly "free" if slices 3–4 read
      live rather than snapshotting) — verification pass, not much new code.
- [ ] **Slice 8 — Performance, polish, regression** (Step 11)
      Perf check at the default 15×13 grid, geometry/material dispose audit, full `vitest run`,
      manual regression check on `/` and `/freestyle`.

## Status legend

`[x]` done and verified · `[~]` partially done, scope noted · `[ ]` not started
