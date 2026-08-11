# Skill: Local Image → Nail Grid Deformation

## Purpose

Provide a repeatable development-time workflow for generating a deformed nail grid from a locally stored reference image.

The primary use case is an image such as a photograph of fabric. The image should influence the spatial positions of the application's nail/control points, producing an organic deformation of the otherwise equidistant triangular lattice.

This skill is **local-only** in the initial implementation.

---

## Input

A local image stored inside the project, for example:

```text
assets/deformation-patterns/fabric.jpg
```

The implementation should not require the image to be uploaded to a server.

---

## Processing Pipeline

```text
Local image
    ↓
Normalize / resize
    ↓
Convert to useful image representation
    ↓
Extract large-scale surface variation / directional structure
    ↓
Smooth noise and remove irrelevant high-frequency detail
    ↓
Generate displacement field
    ↓
Sample displacement at nail positions
    ↓
Apply displacement to base nail grid
    ↓
Render deformed nail grid
```

---

## Important Requirements

### Preserve Grid Topology

The image deformation changes nail positions only.

It must not:

- add nails;
- remove nails;
- reorder nails;
- change neighbor relationships.

### Smooth Deformation

The generated displacement should be spatially smooth.

Individual nails should not jump independently based on individual pixels.

The algorithm should use smoothing/interpolation so that nearby nails move coherently.

### Controllable Strength

The image-derived displacement must have a configurable strength parameter.

A strength of zero should produce the original grid.

Increasing strength should progressively exaggerate the image-derived deformation.

### Configurable Smoothing

The implementation should expose a smoothing parameter or equivalent mechanism to control how much small image details influence the grid.

For photographs such as fabric, large folds should generally influence the deformation more strongly than individual pixels or photographic texture.

### Deterministic Output

Given the same:

- source image;
- base grid;
- image-processing parameters;

the generated deformation should be deterministic.

---

## Development Asset

Use a dedicated project folder for local deformation references.

Recommended:

```text
assets/deformation-patterns/
```

The local image should be imported/referenced by the development implementation.

Do not build production infrastructure around this asset.

The production application must continue to function when the development-only reference image is absent.

---

## Fabric Example

The reference fabric image should be treated as a **surface/deformation map**, not as a texture to display behind the final string art.

Conceptually:

```text
Fabric folds:

       ______
  ____/      \____
 /                \
        ______
_______/      \_____

             ↓

Nail grid bends according to the surface structure
```

The goal is not pixel-perfect physical simulation.

The desired result is a visually convincing organic deformation where the nail lattice appears to follow the folds of the fabric.

---

## Recommended Initial Algorithm

An initial implementation can use:

1. grayscale/luminance conversion;
2. low-frequency smoothing;
3. extraction of surface variation;
4. gradient calculation;
5. normalization/clamping;
6. optional additional smoothing;
7. sampling the resulting field at each nail;
8. converting the sampled field into a displacement vector;
9. applying configurable strength;
10. optionally tapering deformation near the canvas boundaries.

The exact algorithm may be replaced later if a better optical-flow, vector-field, or height-map approach produces more convincing results.

---

## Validation

The skill should be considered successful when a fabric reference image produces:

- visibly non-uniform nail spacing;
- smooth curved rows/columns;
- coherent local movement;
- no isolated/jagged nail jumps;
- recognizable correspondence between major fabric folds and nail deformation.

The generated nail layout should remain usable by the existing string-art drawing engine.

---

## Future Extensions

This skill can later be extended to support:

- arbitrary user-uploaded images;
- production image uploads;
- optical-flow-based deformation;
- depth-map input;
- vector displacement maps;
- black/white displacement maps;
- multiple image deformation modes;
- cached/generated deformation presets.
