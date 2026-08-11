# Deformable nail grid epic — progress tracker

One phase at a time, as agreed. This file is the running checklist; see
[deformable_nail_grid_epic.md](deformable_nail_grid_epic.md) for the full backlog wording,
acceptance criteria (AC1-AC14), and rationale.

## Scoping decisions (confirmed before any code was written)

- **Grid tool only** (`App.js`/`Grid.js`) — freestyle has no nail lattice, out of scope entirely.
- **This round covers Phase 1 (foundation) + Phase 2 (Puppet Warp) only.** Phase 3 (procedural
  presets) and Phase 4 (local image deformation) get their own future scoping rounds - see the
  `nail-grid-defromation` skill for the latter's recommended algorithm when that round starts.
- **Dedicated mode**, not an always-available overlay - Ctrl/Alt-click pin interactions and the
  Deformation submenu only do anything while Deformation Mode is active; a plain click is a no-op
  in that mode rather than falling through to curve-building (AC2).
- **No blocking**: deformation can be entered/adjusted at any time, even after curves exist. No
  retroactive change to existing curves - and none was needed, since `App.js` already copies a
  nail's *value* into a curve on click (`nearest.copy()`), never a live reference to the grid's
  point objects.

## Phase 1 + 2 (✅ implemented)

- [x] **Foundation** — `DeformableGrid` (`src/core/DeformableGrid.js`, +test) wraps the existing,
      untouched `Grid` and exposes the same public shape (`.points`, `.findNearestPoint`) plus pin
      management (`addPin`/`movePin`/`removePin`/`reset`/`findNearestPin`). With zero pins its
      `.points` is `===` behaviorally identical to the base grid's own - no regression to the
      undeformed case (AC1/AC14). `PatternStamper` needed **zero code changes** - it's duck-typed
      against whatever grid-shaped object it's given (`App.js` now passes `this.deformation`
      instead of `this.grid`).
      **Plus** `Grid#findNearestPoint`'s search loop was extracted into a shared, pure
      `src/core/nearestPoint.js` (+test) so `DeformableGrid` doesn't duplicate it - a
      behavior-preserving refactor, `Grid.test.js` passes unmodified.
- [x] **Puppet Warp math** — pure, unit-tested `src/core/deformation/puppetWarp.js`: `smoothFalloff`
      (C¹-continuous smoothstep, guarantees no abrupt jumps between neighbors - AC4), `deformPoint`
      (each pin contributes *its own falloff fraction* of its displacement - a point at weight 0.5
      moves exactly half as far as the pin was dragged, fading to zero at the radius edge; multiple
      overlapping pins sum their contributions, capped at "one full pin's worth" so they don't stack
      past 100% - AC5), `deformGrid`. Influence is measured from each pin's fixed **reference**
      position (where it was created), not its current dragged position, so a pin's affected
      neighborhood stays put in base-grid space as you drag it.
      **Bug fixed post-ship** (caught by the user, not by the unit tests - a real gap in the
      original test coverage): the first version normalized each pin's contribution by the *sum* of
      weights, i.e. a plain weighted average. For a single pin that division always cancels back to
      1.0 regardless of distance (`weight / weight === 1`), so the falloff was computed and then
      immediately erased - every nail inside the radius snapped to the pin's *full* displacement,
      "rubbery" in name only. Fixed by normalizing against `max(1, totalWeight)` instead of
      `totalWeight` - a lone pin's own falloff now applies unmodified, and only an actual
      *combined* overlap exceeding 100% gets scaled back down. Regression tests added for the
      specific case the bug hid in (a single pin, a point partway through its radius).
- [x] **Pin model** — `src/models/Pin.js`: `{id, referencePosition, position, radius, falloff}`.
      Deliberately drops the epic's suggested `active` field - no UI exists to toggle a pin inactive
      without deleting it in this round, so it'd be dead state.
- [x] **Interactive Puppet Warp** — Ctrl-click a nail creates a pin at its base position (AC3);
      Ctrl-click an existing pin and drag moves it, redeforming the grid live every frame (AC4);
      multiple pins coexist and blend (AC5); Alt-click a pin removes it; a plain click on a pin
      selects it (for the panel's radius/falloff fields) without moving/creating anything.
      Hit-testing uses `event.ctrlKey`/`event.altKey` read directly off the native DOM event p5
      passes into `mousePressed(event)`, rather than tracked keydown/keyup state (unlike
      freestyle's hold-V/H/Ctrl flags) - nothing here needs to react to a held key without a click.
- [x] **Deformation submenu** (`src/ui/DeformationUI.js`) — matches the `CanvasSizeUI`/
      `ColorCountUI` "field + Apply" convention: default radius/falloff for new pins, the selected
      pin's own radius/falloff (AC6), Remove Selected Pin, Reset Deformation (AC11), a live pin
      count. Its `isActive` flag is real, independent state (not derived from the panel's
      open/closed state) - matching how an armed pattern (`PatternStore#isInUse`) already survives
      the Patterns submenu being closed elsewhere in this app; deformation mode surviving the
      Deformation submenu being closed (e.g. by opening Colors, or closing the whole burger menu)
      is the same, already-accepted behavior, not a new risk.
- [x] **Pin visualization** — `CanvasView.drawDeformationPins`: bright red/pink markers,
      unmistakable from the grey nail dots or any string color; the selected pin additionally gets a
      ring and a faint outline of its influence radius, so the falloff concept is visible while
      dragging, not just felt.
- [x] **Drawing workflow integration** (AC10) — `#placeAtScreenPoint`'s nail-snapping now reads
      `this.deformation.findNearestPoint(...)` instead of `this.grid.findNearestPoint(...)`, so
      curve points snap to and render from *current* (possibly deformed) nail positions. Existing
      curve/pattern/palette/rendering logic is otherwise completely unchanged.
- [x] **Known limitation, accepted for this round**: canvas size/pan is still computed once from the
      **base** grid's bounding box, as before deformation existed. Nails dragged far enough can
      extend past the padded canvas edge. The epic doesn't ask for auto-resize; revisit if it turns
      out to matter in practice.

#### New files

`src/core/nearestPoint.js` (+test), `src/core/deformation/puppetWarp.js` (+test),
`src/core/deformation/pinParams.js` (+test, radius/falloff field validation), `src/models/Pin.js`,
`src/core/DeformableGrid.js` (+test), `src/ui/DeformationUI.js`.

#### Shared-code changes

- `Grid.findNearestPoint` now delegates to the extracted `nearestPoint.js` helper - same behavior,
  same tests passing.

## Still to be scoped

Phase 3 (procedural deformation presets: Wave, Ripple, Radial/Bulge, Twist, Organic/Noise) and
Phase 4 (local image-derived deformation, e.g. a fabric photograph) - each gets its own clarifying
round when picked up.

## Status legend

`[x]` done and verified (unit tests) · `[~]` partially done, scope noted · `[ ]` not started
