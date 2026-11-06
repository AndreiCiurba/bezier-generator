# Freeform Weave epic — progress tracker

Built in one pass rather than incremental backlog cuts; see
[epic-freeform-weave.md](epic-freeform-weave.md) for the full rationale behind each decision.

## Core math / models / state

- [x] `core/bezierOutline.js` - anchor shape, `autoHandles` (Catmull-Rom auto-smoothing),
      `sampleClosedOutline` (dense preview polyline), `resampleClosedOutline` (N evenly
      arc-length-spaced nails) + tests.
- [x] `core/shapePresets.js` - circle/oval (kappa-construction, smooth) and triangle/rect
      (zero-length-handle, straight-edged) anchor-ring generators + tests.
- [x] `core/shapeTransform.js` - `anchorsCentroid` + `transformAnchors` (translate/rotate/scale
      around a shape's own centroid) + tests.
- [x] `models/FreeformShape.js` - saved shape definition (anchors/nailCount/leap/colors/height),
      `resampledOutline()`, `toJSON`/`fromJSON` + tests.
- [x] `state/ShapeEditorState.js` - Shape Designer's in-progress anchor editing + tests.
- [x] `state/ShapeLibraryStore.js` - committed shapes (add/remove/rename/import/export) + tests.
- [x] `state/ArrangedShapeStore.js` - placed instances (add/remove/move/rotate/rescale/
      height-override/import/export) + tests.

## `/shapes` (Shape Designer)

- [x] Pen tool: click to add anchors, click-near-first-anchor (or Enter) to close the loop,
      Backspace/Delete undoes the last anchor while open.
- [x] Drag an anchor (carries its handles) or a handle (adjusts curvature) once closed.
- [x] Circle/Oval/Triangle/Rect presets, dropped at the canvas center, immediately reshapeable.
- [x] Per-shape settings while drawing: nail count, leap, color-layer count/colors (own
      `StrokePalette`), height override vs. "use global".
- [x] Live preview: smooth outline guide + the actual resampled weave once closed.
- [x] Commit to library; previously-committed shapes stay visible, dimmed, as reference only.
- [x] Library panel: rename in place, delete, export/import the whole library as JSON.
- [x] Page nav wired into every other page (`/`, `/freestyle`, `/3d`, `/arrange`).

## `/arrange` (Arrange Board, 3D)

- [x] Flat board (no nail grid), `OrbitControls` perspective camera, `OrientationGizmo`.
- [x] Import a shape library JSON; sidebar list to arm a shape for placement.
- [x] "Placement Mode" toggle (disables orbit while placing/dragging, same conflict-resolution
      pattern as the grid page's own Drawing Mode).
- [x] Click the board to place an armed shape (frozen snapshot); click/drag an existing instance
      to reposition it (approximate centroid-radius pick, not true geometry raycasting).
- [x] Per-instance edit panel: rotation (degrees), uniform scale, height override vs. "use
      global"; delete.
- [x] Global height default (reuses `NailHeightUI`/`nailHeight.js` from the 3D page).
- [x] Live woven rendering via the extracted `weaveLineBuilder.js` (exact same geometry-assembly
      code the grid page's `/3d` closed-weave cells use).
- [x] Export/import the whole arrangement (instances + their frozen shape snapshots) as JSON.
- [x] Page nav wired into every other page.

## Shared refactor

- [x] `three-page/weaveLineBuilder.js` extracted from `SceneSync.js`'s
      `#buildWeaveObject`/`#buildClosedWeaveObject` (mechanical, `/3d` behavior unchanged -
      full existing test suite still green after the extraction).

## Not done / deliberately out of scope

- [ ] Manual or automated browser verification of either new page.
- [ ] Touch/mobile input on either new page.
- [ ] An on-canvas rotate/scale gizmo on the Arrange board (numeric fields only).
- [ ] True raycast-based instance picking (vs. the current approximate centroid-radius pick).
- [ ] PNG export on either new page.
