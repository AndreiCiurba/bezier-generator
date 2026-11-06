# Epic: Freeform Weave (`/shapes` + `/arrange`)

**Status:** fully implemented in one pass (no incremental backlog cuts - the whole feature was
scoped and built together, see [freeform-weave-progress.md](freeform-weave-progress.md) for the
done/not-done checklist). Not yet manually verified in a browser (see "Known gaps" below).

## Goal

Two new pages generalizing the existing grid-cell "Weave" feature (`core/closedWeaveMath.js`,
`WeaveState`, `WeaveUI` - leap-skip, multi-color-layer string art around a closed polygon) from
grid-detected triangle/square/hexagon cells to **hand-drawn abstract shapes**:

- **`/shapes`** - a Paint-style editor: sketch closed, curvy shapes (circle → oval by dragging,
  triangles, freeform blobs) and configure each one's own nail count, leap, color layers, and
  height as you draw it, then save it into a shape library.
- **`/arrange`** - a 3D board: import a shape library, place multiple independently-configured
  shapes together, and see the real extruded weave for each, with a global default height any
  instance can override.

## Key architectural finding

`closedWeaveSegmentsForCurve(cellCorners, n, leap, colors)` and
`StringArtRenderer.drawClosedWeave(...)` are already polygon-agnostic - neither cares whether
`cellCorners` came from grid-cell detection or anywhere else. Feeding a shape's own resampled
bezier outline in as `cellCorners` (with `n = 0`, since each resampled point already *is* a nail)
reuses that whole engine **unmodified**. The only genuinely new math is "sample a smooth closed
bezier outline into N evenly arc-length-spaced points" (`core/bezierOutline.js`).

## Decisions

### Shape authoring: bezier anchors + handles, not straight-edge polygons

An anchor is `{x, y, handleIn, handleOut}` (`core/bezierOutline.js`) - `handleIn`/`handleOut` are
absolute points, not deltas, so dragging a handle is just "set it to the mouse". A handle left
`null` gets a Catmull-Rom tangent through its closed-loop neighbors (`autoHandles`), so a freshly
placed ring of anchors already looks smooth with no manual handle dragging; an explicit handle
set to its own anchor's position degenerates that edge to a straight line - `core/shapePresets.js`'s
triangle/rect presets use exactly this to stay straight-edged, while its circle/oval presets use
the standard "kappa" 4-anchor cubic-bezier construction.

`resampleClosedOutline(anchors, nailCount)` walks a dense polyline approximation and picks
`nailCount` points evenly spaced by arc length - **this is "nails," the user-facing count**
(total around the shape's own perimeter, matching "a tiny circle can have 20 nails, an oval
100" - not "nails per edge" the way the grid Weave feature's own `n` is).

### No self-intersection enforcement

Neither within a shape's own outline nor between shapes on the same board - confirmed explicitly:
every closed shape is an independent, self-contained weave unit with its own nails/leap/colors/
height, so shapes never need to reason about each other's geometry at all.

### `/shapes`: configure-as-you-draw, one shape at a time

Nails/leap/color-layer-count/height are set *per shape*, before it's committed - not a global
setting shared across every shape the way the grid page's `WeaveState` n/leap are. Committing
freezes the current anchors + settings into a `models/FreeformShape.js` and pushes it into
`state/ShapeLibraryStore.js` (mirrors `PatternStore`, plus `onChange` notification like
`CurveStore`/`StrokePalette`). `height` is `null` by default ("use the Arrange board's global
height") or an explicit override.

### `/arrange`: a real 3D board from the start, no nail grid

No `Grid`/`DeformableGrid` at all - freeform shapes carry their own nails, so there's nothing for
a lattice to do here. `state/ArrangedShapeStore.js` holds placed instances: a **frozen copy** of
the `FreeformShape` it came from (anchors/nailCount/leap/colors/height - never aliasing the
library, same "freeze a copy at placement time" rule `PatternStamper` already follows for grid
patterns) plus its own position/rotation/scale. `core/shapeTransform.js#transformAnchors` applies
that rigid transform around the shape's own anchor centroid before resampling to nails.

**Interaction:** a single perspective `OrbitControls` camera throughout (no locked top-down
Drawing Mode like the grid page's 3D visualizer needs for pixel-precise nail snapping - freeform
placement doesn't need that precision). A "Placement Mode" toggle disables `OrbitControls` while
active, so left-drag can mean "place/drag a shape" instead of "orbit the camera" - the same
underlying conflict `ThreeApp.js`'s own Drawing Mode toggle already solves, reused rather than
inventing a new scheme. Clicking an armed library shape then the board places a frozen instance
there (raycast onto the board's Y=0 plane); clicking/dragging an already-placed instance uses an
*approximate* pick (nearest instance centroid within its own on-board radius) rather than a true
raycast against each instance's thin line geometry - good enough at the scale this page expects
(a handful to a few dozen shapes), not pixel-exact.

### `weaveLineBuilder.js` extraction

`SceneSync.js`'s `#buildWeaveObject`/`#buildClosedWeaveObject` (the "segments → world-space
`LineSegments2`" assembly, including the per-color-layer height baking) were extracted verbatim
into `three-page/weaveLineBuilder.js`, generalized to take an explicit `maxHeight` and
`toWorldPosition` callback instead of always reading `this.nailHeight`/`this.toWorldPosition` -
mechanical, no behavior change on `/3d`. `arrange/ArrangeSceneSync.js` calls the exact same
`buildClosedWeaveLineObject` the grid page's own closed-weave cells use, just with a per-instance
max height and an origin-less world mapping.

### Persistence: JSON export/import only, matching the app's existing convention

No `localStorage`, no live cross-page state - `docs/overview.md` already documents this app has
*no* persistence beyond JSON export/import (Colors/Patterns/Weave recipes). The Shape Designer's
library and the Arrange board's whole arrangement (instances + their frozen shape snapshots -
this app's *first* "export the actual placed design," not just settings) both follow that same
pattern rather than introducing a new one.

## Known gaps, scoped out deliberately

- **Not manually verified in a browser yet** - the `no-e2e` project skill means no automated
  Playwright/Chromium check ran either; say so plainly rather than claiming verified behavior.
- **No touch/mobile support** on either new page - mouse/pointer events only, unlike the grid/
  freestyle pages' explicit tap handling.
- **No on-canvas rotate/scale gizmo** on the Arrange board - rotation/scale/height are plain
  numeric fields in a side panel, by design (see the approved plan - "keep the interaction surface
  small for a first version").
- **Instance picking is approximate** (nearest centroid within an estimated radius), not a true
  raycast against each instance's own line geometry.
- **No PNG export** on either new page (the grid/freestyle pages' `ExportRenderer`/`PngFile`
  flow) - not part of the approved scope.
