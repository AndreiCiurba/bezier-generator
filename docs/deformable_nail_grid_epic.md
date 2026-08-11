# Epic: Deformable Nail Grid & Pattern-Based Grid Generation

## Overview

Introduce a **deformable nail-grid system** to the Bezier / String Art Grid application.

The current application generates an equidistant triangular/rotated lattice of nails. This epic adds a **setup/design stage** where the user can transform that base lattice into an organically deformed control-point layout before creating any string-art curves.

The resulting nail layout becomes the input for the existing drawing workflow. The drawing/curve-generation behavior should remain functionally unchanged; the main difference is that the nails are no longer required to be equally spaced.

The deformation system should support:

1. **Manual Puppet Warp-style deformation** using multiple user-controlled pins.
2. **Procedural deformation presets** such as waves, ripples, radial deformation, twist, and organic/random deformation.
3. **Image-derived deformation**, where a local image (e.g. a photograph of fabric) is converted into a deformation field and applied to the base grid.

The system should be designed around a reusable deformation layer so that all three mechanisms ultimately produce the same type of deformed nail grid.

---

# Goals

- Preserve the existing equidistant grid as the canonical/base grid.
- Allow the user to deform the grid without changing its topology or nail identities.
- Provide an interactive Puppet Warp-style editing experience.
- Support multiple deformation pins simultaneously.
- Update affected nails and the rendered grid in real time while dragging.
- Allow procedural deformation presets to generate a nail layout.
- Allow a local image to be used as a source for generating an organic deformation.
- Keep the generated deformation as a reusable nail-grid/preset that can then be used by the existing string-art drawing workflow.
- Keep the image-based generation local-only for development and experimentation; it must not require image upload/storage in production.

---

# Product Model

The application should conceptually separate the workflow into two stages:

```text
SETUP / DESIGN
    |
    | Base equidistant grid
    v
    Deformation
    |-- Puppet Warp
    |-- Procedural Preset
    |-- Local Image
    v
    Final Nail Grid
    |
    v
DRAWING
    |
    | Existing curve/string-art workflow
    v
    Finished String Art
```

The deformation stage creates the **nail layout**.

The drawing stage continues to work as it does today, except that it operates on the generated/deformed nail positions instead of assuming that nails are equidistant.

Existing curves do **not** need to be retroactively transformed by this feature because deformation is intended to happen during the setup phase, before the drawing/design phase begins.

---

# Core Technical Concept

The base grid must remain available independently from its deformation.

Conceptually:

```text
Base Nail Grid
      +
Deformation State
      |
      v
Deformed Nail Grid
```

A nail should retain a stable identity/index while its rendered position can change.

For example:

```js
{
  id: 37,
  basePosition: { x: 200, y: 150 },
  position: { x: 217, y: 168 }
}
```

The exact data model is implementation-dependent, but the architecture should make it possible to:

- reset the deformation;
- undo/redo deformation changes;
- change deformation parameters;
- switch between deformation methods;
- reuse the generated nail layout;
- keep the base lattice intact.

The deformation system should modify **geometry**, not **topology**.

The relationships between neighboring nails remain the same even though their spatial positions change.

---

# Feature 1: Puppet Warp / Manual Deformation

## User Experience

Add a dedicated **Grid Deformation / Warp mode** during the setup stage.

In this mode:

- Normal click behavior should remain available for the existing workflow where appropriate.
- `Ctrl + Click` on a nail creates a deformation pin.
- A deformation pin can be dragged.
- Multiple pins can exist simultaneously.
- Dragging a pin moves nearby nails according to a smooth influence/falloff function.
- Nails farther away from the pin should move less.
- The deformation should be continuous and smooth.
- The grid should update live while the pin is dragged.

The interaction should feel similar in spirit to Photoshop's Puppet Warp, but it does not need to reproduce Photoshop's exact algorithm.

## Pins

Each pin should contain enough information to calculate its influence over the base grid.

At minimum:

- reference nail/grid position;
- current pin position;
- influence radius;
- falloff;
- active/inactive state.

The initial pin position should correspond to the selected nail.

Dragging a pin should move the associated region of the grid rather than only moving one nail.

## Multiple Pins

Multiple pins must be supported simultaneously.

Example:

```text
       PIN A
         ●
      /     \
    /         \
  ●-------------●
 PIN B        PIN C
```

Each pin contributes to the final displacement.

The implementation should define deterministic behavior when influence regions overlap.

A reasonable initial approach is weighted blending of the displacement contributed by each pin.

## Influence

The deformation should use a smooth falloff.

Conceptually:

```text
Influence
100% ───────●
            |
          /   \
        /       \
      /           \
0% ───────────────────
       distance →
```

The exact mathematical function is implementation-dependent.

The important requirement is that there are no abrupt position changes between neighboring nails.

## Controls

Provide user controls for:

- pin influence radius;
- falloff/smoothness;
- reset deformation;
- removing pins;
- undo/redo if supported by the application's existing state architecture.

Recommended interaction:

- `Ctrl + Click` → create pin
- `Ctrl + Drag` → move pin
- `Alt + Click` or an explicit delete action → remove pin

The exact keyboard shortcut may be adapted to the existing application's interaction model.

---

# Feature 2: Procedural Deformation Presets

Provide a list of predefined deformation patterns.

Initial presets should include at least:

- Flat / Reset
- Wave
- Ripple
- Radial / Bulge
- Twist
- Organic / Noise-based

The preset system should be extensible so new deformation types can be added without changing the rest of the grid-rendering system.

Each preset may expose parameters appropriate to its deformation.

Examples:

### Wave

- amplitude
- frequency
- direction

### Ripple

- amplitude
- frequency
- origin

### Radial / Bulge

- strength
- radius
- center

### Twist

- strength
- center
- radius

### Organic / Noise

- strength
- scale
- smoothness/complexity
- optional seed

Changing preset parameters should update the nail grid live.

---

# Feature 3: Image-Derived Deformation

Allow a local image to be used as a source for generating a deformation field.

The initial target use case is a photograph such as:

```text
fabric.jpg
```

The fabric's folds and surface variation should influence the positions of the nails.

The image should **not** be rendered as part of the final string-art design. It is only an input to calculate the nail deformation.

Conceptually:

```text
Local Image
    |
    v
Image preprocessing
    |
    v
Deformation / displacement field
    |
    v
Base Nail Grid
    |
    v
Deformed Nail Grid
```

The generated result should look conceptually like the original grid has been laid over a piece of fabric and physically distorted according to the fabric's structure.

---

# Local-Only Image Generation

Image-based deformation is intentionally a **development/local feature initially**.

The image source should be stored inside the project repository in a dedicated local folder.

For example:

```text
/assets/deformation-patterns/
    fabric.jpg
    ...
```

or another project-appropriate location.

Requirements:

- The image must be loaded from a local project asset.
- No production image upload is required.
- No image should be uploaded to a backend.
- No external image storage is required.
- The feature should work when running the application locally.
- Production should not depend on the presence of a private/local development image.
- The architecture should allow a future production implementation without requiring the deformation engine itself to be rewritten.

The initial implementation can therefore treat image-based deformation as a **local development tool / skill** rather than a user-upload feature.

---

# Feature 4: Deformation Preview and Controls

The user should be able to see the nail deformation before entering the drawing stage.

The setup UI should make it obvious that:

- the original grid is the base layout;
- the displayed nails are the current deformed layout;
- the user is editing the nail geometry, not drawing string-art curves.

Recommended controls:

- deformation method selector;
- preset selector;
- deformation strength;
- smoothness/falloff;
- reset;
- apply/confirm;
- optionally cancel/revert.

The exact UI should follow the existing application's style.

---

# Integration With Existing Drawing Workflow

The existing string-art drawing functionality should remain unchanged as much as possible.

Once the user finishes the setup/deformation stage:

```text
Final Nail Grid
       |
       v
Existing curve selection
       |
       v
Existing string-art rendering
```

The existing curve logic should use the **current positions of the nails**.

The system must not assume that neighboring nails have equal distances.

The following should continue to work:

- selecting nails;
- creating curves;
- processing consecutive triplets;
- generating string-art line webs;
- applying the existing color palette;
- storing curves;
- creating/reusing patterns.

The deformation feature should therefore be implemented below/alongside the nail-position abstraction rather than by rewriting the existing string-art algorithm.

---

# Persistence / Reusability

A generated deformation should be representable as a reusable state/preset.

At minimum, the state should be sufficient to reproduce the resulting nail layout.

The implementation should avoid storing only a screenshot of the deformed grid.

Prefer storing:

```text
Base Grid Configuration
+
Deformation Configuration
=
Reproducible Deformed Grid
```

For manual deformation this may include:

- pin positions;
- influence radii;
- falloff;
- deformation parameters.

For procedural presets:

- preset type;
- parameters;
- seed where applicable.

For image-derived deformation:

- local image identifier/path;
- image deformation parameters;
- generated deformation state if needed for reproducibility.

---

# Acceptance Criteria

## AC1 — Base Grid Preservation

- The existing equidistant/triangular nail grid continues to work exactly as before when no deformation is applied.
- The original/base position of every nail remains available to the deformation system.
- Deformation does not alter the underlying grid topology.

## AC2 — Enter Deformation Mode

- The user can enter a dedicated grid deformation/setup mode.
- The UI clearly distinguishes deformation/setup from the existing string-art drawing mode.

## AC3 — Create Puppet Warp Pins

- Ctrl-clicking a nail creates a deformation pin.
- The selected nail becomes the initial location of the pin.
- The pin is visually distinguishable from normal nails.
- Multiple pins can be created.

## AC4 — Drag Puppet Warp Pins

- A pin can be dragged interactively.
- While dragging, affected nails move in real time.
- Nails close to the pin move more strongly than distant nails.
- The deformation uses a smooth falloff.
- Neighboring nails do not exhibit abrupt/jagged movement.
- The application remains responsive during normal grid sizes supported by the existing application.

## AC5 — Multiple Pins

- Multiple pins can affect the grid simultaneously.
- Moving one pin does not unexpectedly remove or reset other pins.
- Overlapping influence regions produce a deterministic, smooth result.

## AC6 — Pin Controls

- The user can adjust the influence radius of a pin.
- The user can adjust deformation smoothness/falloff.
- The user can remove a pin.
- The user can reset the complete manual deformation.

## AC7 — Procedural Presets

- The application provides a selectable list of deformation presets.
- At minimum, Flat/Reset, Wave, Ripple, Radial/Bulge, Twist, and Organic/Noise presets are supported.
- Preset parameters can be adjusted.
- Changing preset parameters updates the grid.
- Adding a new preset does not require changes to the existing string-art drawing logic.

## AC8 — Image-Based Deformation

- The application can load a development-time image from a dedicated local project asset folder.
- The image is converted into a deformation/displacement representation.
- Applying the image deformation changes nail positions according to the image structure.
- A fabric photograph produces an organic deformation resembling the folds/surface structure of the source image.
- The source image itself is not part of the resulting string-art drawing.
- No backend upload or production image storage is required for the initial implementation.

## AC9 — Local-Only Development Asset

- The image-based deformation implementation works when running the application locally.
- The implementation does not require a private development image to be available in the production deployment.
- Production builds/deployments do not fail if the development-only image is absent.
- The image-processing implementation is isolated sufficiently that a future production image-input workflow can be added later.

## AC10 — Drawing Workflow Integration

- After deformation is completed, the user can enter the existing drawing workflow.
- Existing curve selection continues to work using the deformed nail positions.
- String-art lines are rendered using the deformed positions.
- The existing palette/coloring behavior remains unchanged.
- The existing curve/pattern functionality remains functional.
- No assumption in the drawing logic requires nails to be equidistant.

## AC11 — Deformation Reset

- The user can reset the deformation and return all nails to their original equidistant positions.
- Resetting the deformation does not modify the base grid configuration.

## AC12 — Performance

- Manual pin dragging updates the grid and preview in real time.
- Deformation calculations do not cause unnecessary reprocessing of unrelated application state.
- The implementation remains usable with the application's existing/default grid sizes.

## AC13 — Reproducibility

- A deformation configuration can be represented as application state.
- Reloading/applying the same deformation configuration produces the same nail layout.
- Procedural/random deformation supports a reproducible seed where randomness is involved.

## AC14 — No Regression

- Existing functionality works when deformation is not used.
- Existing grid generation continues to produce the same layout as before.
- Existing curve generation and rendering behavior remains unchanged for an undeformed grid.

---

# Recommended Technical Architecture

The implementation should introduce a reusable deformation abstraction rather than implementing each feature directly inside the p5.js drawing code.

Conceptually:

```text
                 ┌─────────────────┐
                 │   Base Grid     │
                 └────────┬────────┘
                          │
                          v
                 ┌─────────────────┐
                 │ Deformation     │
                 │ Engine          │
                 └────────┬────────┘
                          │
            ┌─────────────┼──────────────┐
            v             v              v
       Puppet Warp     Presets       Image Field
            │             │              │
            └─────────────┼──────────────┘
                          v
                 ┌─────────────────┐
                 │ Deformed Grid   │
                 └────────┬────────┘
                          │
                          v
                 ┌─────────────────┐
                 │ Existing String │
                 │ Art Engine      │
                 └─────────────────┘
```

A useful conceptual API could be:

```js
deformedPoint = deformationEngine.getPoint(basePoint, deformationState)
```

or:

```js
deformedGrid = deformationEngine.apply(baseGrid, deformationState)
```

The exact API is left to implementation.

The important architectural requirement is that **the drawing engine consumes nail positions and does not need to know how those positions were generated**.

---

# Non-Goals / Out of Scope

The first implementation should NOT include:

- cloud/backend image processing;
- production image uploads;
- user accounts or cloud storage for deformation assets;
- full Photoshop-compatible Puppet Warp;
- mesh editing with arbitrary topology changes;
- changing the underlying triangular lattice topology;
- automatically generating string-art curves from the image;
- changing the existing string-art color/palette algorithm;
- rewriting the existing drawing engine;
- stacking an unlimited number of deformation operations.

Stacking multiple deformation layers may be considered later.

---

# Suggested Implementation Phases

## Phase 1 — Deformation Foundation

- Separate base nail positions from rendered/current positions.
- Introduce deformation state.
- Introduce deformation engine abstraction.
- Ensure existing drawing functionality consumes current nail positions.

## Phase 2 — Puppet Warp

- Add deformation mode.
- Add pins.
- Implement smooth influence/falloff.
- Add interactive dragging.
- Add multiple pins.
- Add reset/remove/parameter controls.

## Phase 3 — Procedural Presets

- Introduce preset interface.
- Implement initial deformation presets.
- Add preset parameter controls.

## Phase 4 — Local Image Deformation

- Add development-only image asset folder.
- Add local image loader.
- Implement image preprocessing.
- Generate displacement/deformation field.
- Apply field to base grid.
- Tune the algorithm against the provided fabric example.

## Phase 5 — Drawing Integration & Validation

- Verify existing curve workflow against deformed grids.
- Verify stored patterns.
- Verify color rendering.
- Test reset and reproducibility.
- Test undeformed-grid regression.

---

# Definition of Done

The epic is complete when a user can:

1. Start with the existing equidistant nail grid.
2. Enter deformation/setup mode.
3. Ctrl-click several nails to create Puppet Warp pins.
4. Drag the pins and see surrounding nails smoothly deform in real time.
5. Adjust the deformation influence.
6. Alternatively choose a procedural deformation preset.
7. Alternatively run the local image-based deformation using a project-local fabric image.
8. Confirm the resulting nail layout.
9. Enter the existing drawing workflow.
10. Select nails and create string-art curves exactly as before, with the only difference being that the nails can now have non-uniform, organically deformed positions.
11. Reset the grid back to its original equidistant state at any time.

The resulting architecture should provide a reusable foundation for future deformation types without coupling deformation logic to the existing string-art rendering engine.
