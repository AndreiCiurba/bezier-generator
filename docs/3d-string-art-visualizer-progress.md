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
- [x] **Slice 7 — Deformation integration** (Step 10)
      Turned out not to be free by itself: `SceneSync` already read nails live through
      `deformation.points` (Slice 3's own setup, deliberately), but `ThreeApp` had no way to *create*
      a Puppet Warp pin in the first place - `DeformationUI` (listed in the original plan's shared-UI
      reuse list) had never actually been wired into this page. Added it for real, not just verified
      it: new `#deformationSubmenu` in `3d/index.html` (identical fields to the 2D grid page's own,
      comment updated to note pin interactions only work in Drawing Mode - see below), `ThreeApp`
      now constructs `DeformationUI` the same way `App.js` does (`#initDeformationControls` +
      `#handleRemoveDeformationPin`/`#handleResetDeformation`/`#handleSelectedPinChanged`, each
      followed by `sceneSync.syncNailPositions()`).
      **Scoping decision**: pin create/Ctrl-drag/Alt-remove is reachable only while Drawing Mode is
      ON, piggybacking on its pointer listeners - unlike the 2D page, where Deformation Mode is a
      totally independent, always-live canvas feature. This page has no such "always live" canvas;
      raycasting a screen point onto the board/nail plane only exists via the locked top-down
      Drawing Mode camera, so pin editing shares that same gate rather than building a second,
      perspective-camera-aware raycast path the epic never asked for. Documented as a deliberate
      divergence, not an oversight.
      Drawing Mode's interaction was switched from a single `click` listener to `pointerdown`/
      `pointermove`/`pointerup` (`#handleCanvasPointerDown` dispatches to
      `#handleDeformationClick` when `deformationUI.isActive`, else the existing curve/pattern
      `#handleDrawingClick`) - needed for Ctrl+Drag to track motion between press and release,
      mirroring `App.js`'s `mouseDragged`/`mouseReleased` pin-drag handling exactly. As a side
      effect this also fixed a latent mismatch: `click` fires on mouseup, but `App.js#mousePressed`
      (and now this page too) place points on *press*, matching p5's real mousePressed semantics.
      `#handleDeformationClick` is a line-for-line port of `App.js#handleDeformationClick`
      (Ctrl+Click grab-or-create, Alt+Click remove, plain click select) against this page's own
      `deformation`/`deformationUI`. New `SceneSync#setDeformationPins(pins, selectedPin)` - not
      requested by the epic's own acceptance criteria, but necessary for usability: without a visual
      marker there's no way to see where an existing pin is to Ctrl-click-grab it again on a locked
      top-down view. Renders a flat dot per pin plus a translucent ring at the selected pin's actual
      radius, same color/shape language as the 2D page's `CanvasView.drawDeformationPins`, rebuilt
      wholesale on every call (pin counts are always small - no incremental diffing needed, unlike
      `#syncCurves`). A Grid Size change now also resets the Deformation submenu's displayed pin
      count/selection to match the fresh (zero-pin) `DeformableGrid` it creates. Full `vitest run`:
      36 files / 238 tests passing (unchanged - this slice is DOM/Three wiring, no new pure logic).
      Manual/visual verification (Ctrl+Click/drag/Alt+Click a pin in Drawing Mode, confirm nails +
      pin markers move live, confirm curves placed before/after a drag look right) not yet run — per
      the `no-e2e` skill, only on explicit request.

      **Follow-up (user-reported bugs, same session): pattern stamping ignored grid resize/deformation.**
      Two real bugs in shared `src/app/PatternStamper.js` (used by both `/` and `3d/`), caught via a
      screenshot of Auto-stamping wildly overflowing a small resized board:
      1. **Stale grid reference after a 3D "Grid Size" change.** `ThreeApp.stamper` is constructed
         once, in the constructor, against the *original* `DeformableGrid` instance. `#handleGridSizeChange`
         already swapped `this.deformation` to a brand-new instance on resize, but never told the
         already-built `stamper` about it - so Auto/manual stamping kept anchoring against the
         original grid's nails forever, no matter what size was picked afterwards. Fixed with a new
         `PatternStamper#setGrid(grid)`, called from `#handleGridSizeChange` right after the new
         `DeformableGrid` is built.
      2. **Rigid translation, not nail-connection.** `stampAtScreenPoint`/`stampThroughoutGrid` used
         to place a pattern's points via a pure rigid translate (`translatePointsTo`/`Pattern#translatedTo`)
         with no check that the *result* actually landed on real nails. On an unchanged grid this is
         invisible (a pattern's points were themselves real nails when captured, and translation
         preserves the exact lattice-offset vectors between them, so they land back on real nails
         automatically) - but it breaks down exactly where the user hit it: Auto-stamping near the
         edge of a *resized* grid pushes some translated points past where any nail exists at all, and
         stamping onto a *deformed* grid means the undeformed lattice math the raw translate assumes
         no longer matches where nails actually are. Fixed with `PatternStamper#snapToNails` - every
         translated point is re-resolved to `grid.findNearestPoint(point, NAIL_SNAP_RADIUS)` (10, the
         same tolerance every other nail-snap in the app already uses) against the grid's *live*
         (possibly deformed) positions, and copied (never aliasing the grid's own live `Point`s, so a
         later deformation change can't retroactively reshape an already-placed curve). Returns `null`
         - not a partial shape - the moment *any* single point has no nail within reach, so a stamp
         that only partly fits is skipped entirely rather than drawn floating/disconnected - directly
         implements the "if there is no corresponding nail to connect to, it should not be drawn" ask,
         and "should not get out of it" falls out for free (an off-grid point has no nearby nail by
         construction).
      Both fixes live in the one shared class both pages already use, so the deformed-grid connection
      fix benefits `/` too, not just `3d/` (Puppet Warp deformation has existed there since the
      deformable-nail-grid epic; this was always a latent bug there, just harder to notice manually
      since that page's grid never resizes). `PatternStamper.test.js` rewritten: the two existing
      translate/flip tests now use *real* lattice-neighbor offsets (found by nearest-neighbor search
      against the actual grid, not hand-picked arbitrary numbers) so they keep landing on real nails
      under the new stricter behavior, plus four new tests - reject-a-non-lattice-offset,
      reject-if-any-point-misses (both `stampAtScreenPoint` and `stampThroughoutGrid`),
      snap-to-actual-deformed-position (builds a real `DeformableGrid` + pin), and
      `setGrid` re-anchoring against a resized grid. Full `vitest run`: 36 files / 242 tests passing
      (+4 net new). Manual/visual verification of the fix on the actual 3D page not yet run — per the
      `no-e2e` skill, only on explicit request.
- [x] **Slice 8 — Performance, polish, regression** (Step 11)
      A static code audit (no live/browser stress test - see below), going through every
      `new THREE.*Geometry`/`*Material` construction site in `src/three-page/` against its dispose
      path:
      - **Board** (`SceneSync`): material built once, reused for the board's whole lifetime -
        thickness changes only dispose/rebuild the *geometry*, color changes mutate the existing
        material's `.color` in place. Already correct since Slice 2.
      - **Nails**: one `InstancedMesh`/one draw call regardless of grid size; per-nail transform lives
        in the instance-matrix buffer, not per-object geometry - a nail-height change only rewrites
        that buffer. Geometry/material only rebuilt on an actual grid-size change (`setGrid`), and
        `#disposeNails` runs first every time. Already correct since Slice 3.
      - **Curves**: one `LineSegments2`/geometry/material per curve (each curve's own vertex colors
        make sharing a material impossible) - `#syncCurves` diffs by id and only disposes+rebuilds
        ids that actually left the store, never touches surviving curves' geometry for an unrelated
        add/undo. A nail-height change *does* rebuild every curve (color-layer height is baked into
        vertices, not a transform - documented, deliberate). Already correct since Slice 4. **Known,
        accepted scaling characteristic, not a bug**: this is one draw call *per curve*, so a design
        with hundreds of curves (e.g. Auto-stamping a pattern across a large grid) means hundreds of
        draw calls - no batching across curves exists. Left as-is: batching would cost the
        add/remove/dispose-by-id simplicity `#syncCurves` relies on, for a win that can't be measured
        without a live GPU (no-e2e), on top of an already-large slice.
      - **Deformation pin markers** (new in Slice 7): *this one wasn't right* - `setDeformationPins`
        built a brand-new `CircleGeometry`/`RingGeometry`/two `MeshBasicMaterial`s from scratch on
        *every single call*, and a pin drag calls it on every `pointermove` - potentially dozens of
        times a second while dragging. Fixed: `pinDotGeometry`/`pinDotMaterial`/`pinRingGeometry`/
        `pinRingMaterial` are now module-level singletons, built once and reused by every pin
        `Mesh` (a `Mesh` itself is just a transform + shared references, cheap to recreate). The ring
        is a thin unit annulus scaled per-instance via `mesh.scale` to each pin's actual radius,
        rather than baking the radius into the geometry - keeps it shareable too. `dispose()` updated
        to match: pin markers are no longer disposed there (they don't own their geometry/material
        any more than `InstancedMesh`'s shared nail geometry does).
      - **Gizmo** (`OrientationGizmo`): everything built once in the constructor; `render()` reuses
        scratch `Vector2`/`Vector3`s, no per-frame allocation. Already correct since Slice 5.
      - **Drawing Mode camera raycasting**: reuses scratch `Raycaster`/`Vector2`/`Vector3`, no
        per-call allocation. Already correct since Slice 6.
      No accumulation of stale objects found anywhere else; `#animate`'s per-frame work
      (`controls.update`/`renderer.render`/`gizmo.render`) allocates nothing new per frame either.
      Full `vitest run`: 36 files / 242 tests passing (unchanged - this slice touched only
      already-outside-the-test-boundary `SceneSync` internals). "No regression in 2D functionality"
      verified by review rather than by running the page: `App.js`/`FreestyleApp.js` are untouched by
      every 3D-only change in Slices 1-8, and the one change that *does* touch shared code (Slice 7's
      follow-up `PatternStamper` fix) is covered by its own updated/expanded test suite, which is
      green.
      **Not run - live/manual verification, per the `no-e2e` skill (only on explicit request)**:
      actual FPS/responsiveness at a large (41×41) grid or a many-curve design, live resize behavior,
      Drawing Mode enter/exit transitions, a live deformation drag, and a live regression pass on `/`
      and `/freestyle` in an actual browser. Say the word (or "test in the browser") if you want that
      pass run.

This closes every step (1-11) in the epic's own breakdown. Remaining before calling the epic itself
fully done: an explicit live/browser verification pass across all of it (deliberately deferred
throughout per the `no-e2e` skill), and a decision on whether the known curve-count draw-call scaling
characteristic above needs addressing for realistic large designs.

## Follow-up (post-epic, user-requested): slimmer weave-subdivision nails

Not one of the epic's own numbered steps - a direct fidelity request, explicitly modeled on the 2D
page's own PNG "nails" export (`ExportRenderer`/`nailPositionsForCurve.js`): a physical board doesn't
just have nails at the control points a curve was actually clicked through - the weave passes through
extra intermediate points along each edge (`colors.length` segments per edge, same "more colors → more,
closer subdivision points" math the export already uses), and a real board needs a small pin at each
one too.

`SceneSync` now builds a second, combined `InstancedMesh` ("inner nails") from every *visible* curve's
`nailPositionsForCurve(curve).innerPoints` - the exact same pure function/math the 2D export already
uses, no new geometry logic invented. Design decisions:
- **Visibly slimmer than the main lattice nails** - both shaft and head radius roughly halved
  (`INNER_NAIL_SHAFT_RADIUS`/`INNER_NAIL_HEAD_RADIUS` vs. the main nails' `SHAFT_RADIUS`/`HEAD_RADIUS`)
  - reads as secondary/auxiliary, not more main nails. `buildNailGeometry` (previously hardcoded to
    the main nail's own constants) now takes radii/facet-count parameters so the exact same builder
    produces both shapes.
- **Same full board-to-nail-height span as the main nails** (not one small nail per color layer at
  each layer's own Z) - this mirrors the 2D export's own model, where every nail (control or inner)
  is the *same kind* of physical nail regardless of which color happens to pass through it, matching
  how a real board is actually nailed (one tall nail per hole; different colored wraps happen at
  different heights along the *same* nail, which is exactly what this app's existing per-layer-Z
  curve model already visualizes).
- **Only for already-drawn curves** - built from `design.visibleCurves`, so a hidden curve's inner
  nails disappear along with its strings (same trigger, `curveStore.onChange`, as the existing curve
  sync), and the in-progress Drawing Mode selection (not yet committed) never gets any.
- **Geometry/materials are shared module-level singletons** (`innerNailGeometry`/`innerNailMaterial`),
  applying the same reuse lesson Slice 8 had just established for the pin markers - only the
  `InstancedMesh`'s own instance *count* changes as curves are added/removed/hidden, never the
  geometry it points at. A nail-height change reuses the already-computed point list and only
  rewrites the instance-matrix buffer (no rebuild), same treatment as the main lattice.

Full `vitest run`: 36 files / 242 tests passing (unchanged - `SceneSync` stays outside the unit-test
boundary, same as every other Three-touching change in this doc). Manual/visual verification not yet
run — per the `no-e2e` skill, only on explicit request.

**Follow-up to the follow-up (same request): toggle + 40% slimmer overall.** Two more asks in the same
message:
- **"Show Inner Nails" checkbox**, default checked (matches the feature's existing always-on
  behavior) - `SceneSync#setInnerNailsVisible(visible)` is a cheap `.visible` flip on the existing
  `InstancedMesh`, no rebuild, mirroring how a single curve's own visibility toggle already works in
  `#syncCurves`. Since a curve-store change (`#rebuildInnerNails`) replaces the `InstancedMesh` object
  wholesale, the chosen visibility has to be re-applied to the *new* object every time, not just set
  once - `this.innerNailsVisible` is the persistent flag both paths read.
- **All nails - control *and* inner - 40% slimmer**, both shaft and head. Rather than four
  independently hand-edited radii, added one `NAIL_SLIMNESS_FACTOR = 0.6` multiplier applied to both
  the main (`SHAFT_RADIUS`/`HEAD_RADIUS`) and inner (`INNER_NAIL_SHAFT_RADIUS`/
  `INNER_NAIL_HEAD_RADIUS`) constants, so the relative "inner nails are visibly thinner than control
  nails" proportion from the previous follow-up is preserved exactly, not just approximately re-eyeballed.

Full `vitest run`: 36 files / 242 tests passing (unchanged). Manual/visual verification not yet run —
per the `no-e2e` skill, only on explicit request.

## Status legend

`[x]` done and verified · `[~]` partially done, scope noted · `[ ]` not started
