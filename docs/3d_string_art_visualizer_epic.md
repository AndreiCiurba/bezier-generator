# Epic: 3D String Art Visualizer

## Overview

Create a new page that provides a full 3D visualization of the existing Bezier / String Art Grid application.

The existing 2D application remains the source of truth for the nail grid, deformation state, curves, string colors, and drawing logic. The new page consumes that design model and renders it as a physical 3D representation.

Use **Three.js** for the 3D page. Keep **p5.js** for the existing 2D generator.

The goal is to make the physical structure understandable from different viewpoints, especially from the side, where the user can see how individual curve layers overlap vertically.

---

## Core 3D Model

A 2D/deformed nail position `(x, y)` becomes:

`(x, y, z)`

where:

- `x` = deformed horizontal position;
- `y` = deformed position on the board plane;
- `z` = global nail height.

The 3D nail must therefore be derived directly from the existing deformed 2D nail:

```text
Base Grid
    ↓
Deformation Engine
    ↓
Deformed X/Y
    ↓
Global Nail Height
    ↓
3D Nail Position
```

No separate 3D deformation algorithm should be introduced.

---

## Curve / String Z-Layer Model

A **curve is the logical Z-layer**.

Each curve can contain many individual string/line segments, and those segments can have different colors. In 2D they visually overlap; in 3D the complete curve is placed at one Z height.

Example:

```text
Curve 1
  string 1 → red
  string 2 → blue
  string 3 → red
  ...

Curve 2
  string 1 → yellow
  string 2 → green
  ...
```

The curves are distributed evenly between the board/string baseline and the nail height.

If there are `N` curves, each curve receives a distinct, evenly distributed Z position. Individual string colors remain unchanged.

---

## Global Controls

Provide:

### Nail Height

A global control defining the Z height of every nail.

Changing it updates all nail positions and the available range for curve layers.

### Board Thickness

A control defining the physical thickness of the board.

### Board Color

A color picker/control for the board material.

### Curve Layer Distribution

Curve layers should be automatically and evenly distributed between the board/string baseline and the nail height. The highest string layer should remain below the nails.

---

## Board Rendering

Render the board as a real Three.js 3D mesh.

Requirements:

- configurable thickness;
- configurable color;
- visible sides from oblique angles;
- aligned with the nail grid;
- scales with the grid dimensions.

---

## Nail Rendering

Render every nail as a 3D object.

Each nail uses:

```text
X = deformed nail X
Y = deformed nail Y
Z = global nail height
```

Nail IDs must remain consistent with the 2D model.

---

## String Rendering

Every existing string/line segment must be rendered in 3D.

For a segment between nails A and B:

```text
start = (A.x, A.y, curveZ)
end   = (B.x, B.y, curveZ)
```

Preserve:

- connectivity;
- curve ordering;
- individual string colors;
- existing curve geometry.

Do not regenerate different string-art geometry for the 3D page.

---

## 3D Inspection Mode

The default mode uses a **perspective camera**.

Support:

- orbit/rotation;
- pan;
- zoom;
- camera reset.

Prefer Three.js `OrbitControls` rather than implementing custom camera mathematics.

Recommended interaction:

- left drag → orbit;
- right/alternate drag → pan;
- wheel → zoom.

---

## Drawing Mode

Add a **Drawing Mode** toggle.

When OFF:

- perspective camera is active;
- orbit is enabled;
- pan is enabled;
- zoom is enabled;
- the user can inspect the physical 3D structure.

When ON:

- all camera interaction is disabled;
- no orbit;
- no pan;
- no camera movement;
- the scene switches to an exact top-down orthographic view;
- the user can draw using the existing drawing interaction model.

The 3D scene itself remains active. Do not replace it with a separate 2D canvas.

### Drawing Camera

Use a dedicated orthographic camera:

- directly above the board;
- perpendicular to the board;
- centered consistently with the existing 2D coordinate system;
- without perspective distortion;
- locked while Drawing Mode is active.

The result should visually match the existing 2D layout as closely as possible.

### Drawing Interaction

Use Three.js raycasting to map mouse coordinates onto the board/nail plane.

Reuse the existing:

- nail selection logic;
- curve-generation logic;
- string-color logic.

Newly created curves must immediately appear in the 3D scene.

---

## Camera State

When entering Drawing Mode:

1. Save the current perspective camera state.
2. Switch to the locked top-down orthographic camera.
3. Disable camera controls.
4. Enable drawing.

When leaving Drawing Mode:

1. Restore the previous 3D camera state.
2. Re-enable camera controls.
3. Return to perspective inspection.

The user should not lose their previous 3D viewpoint.

---

## XYZ Legend

Add a persistent XYZ orientation legend in the **bottom-right corner** of the viewport.

It must clearly show:

- X;
- Y;
- Z.

The legend should remain fixed to the viewport rather than moving with the 3D scene.

---

## Z-Layer Visualization

The application already has a Z-layer visibility toggle.

Integrate the 3D renderer with that existing state rather than creating an unrelated duplicate.

The 3D view should clearly show vertical separation between curve layers when visible.

---

## Shared Data Model

The 3D page must consume the same logical design state as the 2D page.

Keep consistent:

- nail IDs;
- base positions;
- deformed positions;
- curve definitions;
- curve ordering;
- individual string colors;
- selection state where applicable;
- Z-layer ordering.

The 3D page must not maintain an independent copy of the design.

---

# Implementation Steps

## Step 1 — Shared Design Model / 3D Data Boundary

### Goal

Prepare the existing application so another renderer can consume the design.

### Tasks

- Identify nail/grid state.
- Identify curve/string state.
- Separate logical design state from p5.js rendering where necessary.
- Expose stable nail IDs and positions.
- Expose curve ordering and individual string colors.
- Expose final deformed nail positions.
- Define curve Z-layer calculation.

### Acceptance Criteria

- Existing 2D behavior is unchanged.
- The design can be represented without relying on p5.js drawing objects.
- Nails, curves, colors and deformation output can be consumed by another renderer.

---

## Step 2 — Create the 3D Page and Three.js Foundation

### Goal

Create the new page and basic Three.js scene.

### Tasks

- Add Three.js.
- Create the new page.
- Create scene, renderer and perspective camera.
- Add resize handling.
- Add basic lighting/materials.
- Add OrbitControls.
- Render a test object.

### Acceptance Criteria

- New page loads independently.
- Existing 2D page remains functional.
- Three.js renders successfully.
- Perspective camera works.
- Orbit, pan and zoom work.
- Resizing works.

---

## Step 3 — Render the Board

### Goal

Introduce the physical board.

### Tasks

- Create board mesh.
- Match board dimensions to the current grid.
- Add thickness control.
- Add board color control.
- Add material/lighting.

### Acceptance Criteria

- Board is visible in perspective.
- Thickness is configurable.
- Color is configurable.
- Board scales with the grid.
- Board sides are visible from oblique angles.

---

## Step 4 — Render the 3D Nail Grid

### Goal

Convert the existing nails into 3D nails.

### Tasks

- Create 3D nail geometry.
- Use deformed X/Y coordinates.
- Add global nail-height control.
- Preserve nail IDs.
- Update positions when the underlying grid changes.

### Acceptance Criteria

- Every 2D nail has a 3D representation.
- X/Y exactly match the deformed 2D grid.
- Nail height is globally configurable.
- Deformation changes are reflected automatically.

---

## Step 5 — Render Curve/String Layers

### Goal

Visualize the existing string art in 3D.

### Tasks

- Assign every curve a Z layer.
- Evenly distribute layers between board/string baseline and nail height.
- Render every string segment.
- Preserve individual colors.
- Preserve curve ordering.

### Acceptance Criteria

- All existing curves are visible.
- Each curve occupies a distinct Z layer.
- Layers are evenly distributed.
- Colors remain unchanged.
- Side views clearly reveal vertical separation.
- 3D geometry corresponds to the existing 2D geometry.

---

## Step 6 — Integrate Existing Z-Layer Visibility

### Goal

Use the application's existing Z-layer visibility state.

### Tasks

- Connect the 3D renderer to the existing toggle/state.
- Define the 3D behavior for hidden/shown layers.
- Avoid duplicate layer state.

### Acceptance Criteria

- Existing Z-layer toggle works in the 3D page.
- State remains synchronized.
- No conflicting second implementation exists.

---

## Step 7 — 3D Camera and Inspection UX

### Goal

Make the scene useful for physical inspection.

### Tasks

- Configure perspective camera.
- Configure OrbitControls.
- Add camera reset.
- Choose a useful initial camera position.
- Add bottom-right XYZ legend.

### Acceptance Criteria

- User can inspect above, side, front and arbitrary angles.
- Orbit, pan and zoom are smooth.
- Reset returns to a useful default view.
- XYZ legend remains fixed and readable.

---

## Step 8 — Drawing Mode

### Goal

Allow curves to be created directly in the 3D page.

### Tasks

- Add Drawing Mode toggle.
- Add dedicated orthographic top-down camera.
- Save current 3D camera state.
- Disable OrbitControls while Drawing Mode is active.
- Lock the camera.
- Raycast mouse coordinates onto the board/nail plane.
- Reuse existing nail selection and curve-generation logic.

### Acceptance Criteria

- Drawing Mode can be toggled.
- ON = exact top-down orthographic view.
- Orbit is disabled.
- Pan is disabled.
- Camera movement is disabled.
- User can select nails.
- User can create curves.
- New curves immediately appear in 3D.
- Existing colors remain correct.

---

## Step 9 — Camera State Restoration

### Goal

Make switching between inspection and drawing seamless.

### Tasks

- Save perspective camera state when entering Drawing Mode.
- Switch to drawing camera.
- Restore previous perspective state when leaving.
- Re-enable controls.

### Acceptance Criteria

- Previous 3D viewpoint is preserved.
- Enter/exit transitions work reliably.

---

## Step 10 — Deformation Integration

### Goal

Connect the 3D page to the deformable nail-grid system.

### Tasks

- Consume final deformation X/Y positions.
- Update 3D nails after Puppet Warp.
- Update after procedural presets.
- Update after image-based deformation.
- Keep Z equal to global nail height.

### Acceptance Criteria

- All supported 2D deformations appear in 3D.
- No separate deformation algorithm exists in the 3D page.
- Nail height remains independent of X/Y deformation.
- Curves continue to reference the correct nail IDs.

---

## Step 11 — Performance, Polish and Regression Testing

### Goal

Make the visualizer stable with realistic designs.

### Tasks

- Test large nail grids.
- Test many curves and string segments.
- Reuse Three.js materials where possible.
- Avoid unnecessary geometry recreation.
- Dispose obsolete geometry/materials.
- Test repeated design changes.
- Test responsive resizing.
- Test Drawing Mode transitions.
- Test deformation updates.
- Test the original 2D page.

### Acceptance Criteria

- No regression in 2D functionality.
- 3D remains responsive with representative designs.
- Camera and Drawing Mode remain responsive.
- Geometry does not accumulate stale objects.
- No obvious memory leaks.
- Production build/deployment remains functional.

---

# Technology Decision

## Existing 2D Renderer

Continue using **p5.js**.

Do not rewrite the existing 2D generator.

## New 3D Renderer

Use **Three.js**.

Three.js should provide:

- WebGL rendering;
- perspective camera;
- orthographic camera;
- OrbitControls;
- 3D geometry;
- materials;
- lighting;
- raycasting;
- 3D interaction.

Do not implement a custom camera/control system unless Three.js functionality is insufficient.

---

# Out of Scope

The first version does not include:

- physics simulation;
- realistic cloth/string dynamics;
- physically simulated nails;
- VR/AR;
- multiplayer editing;
- cloud 3D rendering;
- replacing the p5.js 2D renderer;
- rewriting the string-art algorithm in Three.js.

---

# Definition of Done

The user can:

1. Open the new 3D visualizer.
2. See the existing/deformed nail grid as 3D nails.
3. See a configurable 3D board.
4. See every curve at its own evenly distributed Z layer.
5. See individual string colors preserved.
6. Change nail height.
7. Change board thickness.
8. Change board color.
9. Orbit the scene.
10. Pan and zoom.
11. Inspect the design from the side to understand string overlap.
12. See a fixed XYZ legend.
13. Use the existing Z-layer visibility behavior.
14. Toggle Drawing Mode.
15. See an exact top-down orthographic view in Drawing Mode.
16. Have all camera movement disabled while drawing.
17. Select nails and create curves in Drawing Mode.
18. See new curves immediately in the 3D scene.
19. Return to the previous 3D camera position after Drawing Mode.
20. See 2D/deformed nail positions automatically reflected in 3D.
21. Continue using the existing p5.js application without regression.

The final architecture must treat the shared design model as the source of truth, with p5.js and Three.js acting as separate renderers.
