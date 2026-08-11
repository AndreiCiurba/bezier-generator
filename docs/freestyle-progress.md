# Freestyle epic — progress tracker

One backlog item at a time, as agreed. This file is the running checklist; see
[epic-freestyle.md](epic-freestyle.md) for the backlog's full wording, decisions, and rationale
behind each one.

## Backlog

- [x] **1. New page with a blank canvas** — `/freestyle/`, empty canvas, no grid.
- [x] **2. "Foaie de calcul" capability** — unit-aware canvas-size input (accepts "20cm", "600px",
      a bare number defaults to px; DPI is a user-configurable field) **plus** a graph-paper
      backdrop on the canvas itself: divided into square cells (100 along the longer side,
      proportionally fewer on the shorter side, so a 2:1 canvas gets 100×50 - cells never stretch),
      a bold moderate-grey line every 10 cells, darker-grey minor lines between (`GraphPaperRenderer`
      + pure `graphPaperMath.js`). Drawn in world space, so it pans/zooms with the design. **Plus** a
      live "rubber band" line from the last placed point to the cursor while building a curve,
      fading grey→yellow across a 50px screen falloff as it gets closer to perfectly horizontal or
      vertical, any zoom - with red as a separate, discrete snap only within 1px of exactly
      on-axis, not part of the fade, so a genuine pixel-perfect line jumps out unmistakably
      (`LivePreviewLine` + pure `lineAlignment.js` + `colorGradient.js`).
      Only the in-progress segment; committed segments keep their normal color.
- [x] **3. Canvas size pre-selection** — preset dropdown (20×20, 30×30, 30×40, 40×40, 50×50 cm)
      + custom width/height fields, centered on screen. **Default: 20×20cm @ 90 DPI** (709×709px).
- [x] **4. Number of colors pre-selection** — a "Colors" field + Apply button (1–25) resizes the
      palette (`StrokePalette#resize`, `ColorPickerUI#rebuild` regenerates the swatch inputs).
      1:1 coupled with weave fineness, as decided: `segments` always equals the color count -
      each curve/pattern uses its *own* `colors.length`, not the live palette size, so changing
      the count doesn't alter how already-drawn curves render. Changing the count clears the
      current design (same as a canvas-size change). **Now on both pages** - originally
      freestyle-only, extended to the grid tool on request; the underlying pieces
      (`colorCount.js`, `ColorCountUI`, `strokeWeight.js`) moved to shared `src/state`/`src/ui`/
      `src/core` homes accordingly.
      **Plus** line thickness scales with color count: exactly today's weight (0.6) at 8 colors,
      thicker for fewer (quadruples at 2), thinner for more - **plain inverse proportionality**
      (double the colors, half the weight), not the original inverse-square-root, which tapered
      too gently past 8 to read as a real change ("visually almost unchanged" feedback - the
      steeper curve fixed that: 25 colors now clearly shows individual thin strands instead of a
      near-solid wedge).
      **Plus** newly-added slots (growing the count) get a **random color each**, not repeated
      white (`src/utils/color.js#randomHexColor`).
      **Plus** applying a saved favorite color bundle whose size differs from the current palette
      **auto-resizes the palette to match** (e.g. a bundle saved/exported with 11 colors, applied
      later against the 8-color default, brings the palette to 11 automatically) -
      `FavoritesUI#applyBundle`.
      E2e-verified (twice - the initial version and this expanded one): picker count/default
      confirmed on both pages; growing the grid tool's palette 3→6 and freestyle's 8→12 both gave
      distinct random, non-white new colors; an isolated-line pixel measurement at 1 color
      (7px→10px after the steeper formula) confirmed the new curve is genuinely wired into
      rendering; screenshots across 1/2/8/25 colors show the much more visible progression; saving
      an 11-color bundle, resetting to 8, then applying that bundle correctly brought the palette
      (and the displayed count field) back to 11 on both the picker count and `colorCountInput`.
- [x] **5. Freestyle pattern creation** — click anywhere (no snapping) to place control points;
      Reset/Clear All/Undo, colors, favorites, and patterns (save/select/stamp) all work the same
      as the grid tool, minus the Manual/Auto toggle (nothing to auto-stamp across without a grid).
- [x] **6. Display with hover — greyed out or not** — an armed pattern (selected, Manual mode) now
      shows a **greyed-out ghost preview that follows the cursor anywhere on the canvas**, not just
      while hovering its row in the list (the original, narrower behavior - kept as-is, as decided,
      alongside this new one). Shows exactly where the pattern would land if clicked right now, in
      the pattern's own real density (segments/line-weight derived from its own color count, not a
      fixed 7-white-layer placeholder). Works on both pages (`App#drawArmedPatternPreview` /
      `FreestyleApp#drawArmedPatternPreview`, `CanvasView.drawArmedPatternPreview`).
- [x] **7. V / H pattern flip (partial - arrow-key nudging still open)** — **hold** V or H (a
      momentary key-hold, not a toggle, as clarified) shows the ghost preview mirrored vertically/
      horizontally around the pattern's own anchor point; releasing the key returns to normal.
      Clicking while held stamps the pattern in that mirrored orientation - preview and real stamp
      always match (`pointTransforms.js#flipPoints`, applied in both stamper classes and the
      preview renderer). Guarded against firing while typing in a form field
      (`src/ui/keyboardFocus.js#isTypingTarget`) and against a stuck-flipped state if focus leaves
      the page mid-hold (reset on `window blur`). Arrow-key nudging (the other half of backlog
      item 7) not started.
- [x] **8. Drag & drop a control point (all copies vs. just one)** — freestyle only. Holding
      **Ctrl** with nothing armed/in-progress (no pattern selected, no in-progress manual curve)
      highlights every curve's control points, gold-accent dots. Ctrl-clicking one and dragging
      reshapes that curve live (`#tryStartPointEdit`/`#dragActivePoint` in `FreestyleApp`, hit-test
      via the new pure `findNearestCurvePoint`). Holding **Shift** too moves the same point on
      every other curve stamped from the same pattern, live, every frame (`shiftSiblingPoints`) -
      the "all copies vs. just one" toggle, expressed as a held modifier. Applies to **all**
      committed curves, not just pattern-stamped ones (Shift is just a no-op for a plain hand-drawn
      curve, since there's no sibling to sync). Edits only the on-canvas curve instance(s) - the
      saved pattern template in the library is untouched. New `src/core/pointEditing.js` (+test).
      **Follow-up:** the shape you originally drew (before saving it as a pattern) now moves
      along with that pattern's stamped copies too under Shift, not just the copies - saving a
      pattern tags the selection so that if it's committed unchanged right after, the resulting
      curve shares the pattern's id (`PatternUI#onPatternSaved` → `FreestyleApp#pendingOriginPatternId`).
- [x] **9. Export image (nails-only, and nails+lines)** — freestyle only, PNG (superseded the
      backlog's original PDF/JPEG mention). Two buttons: **Export Nails** (control + inner points,
      control points wider - `ExportRenderer.renderNails`) and **Export Nails + Strings** (same
      dots plus the actual woven strings in their real palette colors -
      `ExportRenderer.renderNailsAndStrings`). White background, black dots (the editor's dark
      theme doesn't print well); exports every currently-visible curve (committed + an in-progress
      ready selection); rendered onto an offscreen `p5.Graphics` buffer at the canvas's own pixel
      size (already DPI-calibrated, no extra scaling needed) and downloaded via new
      `src/io/PngFile.js`. "Inner points" = the physical nail positions the weave math subdivides
      between each pair of control points (`src/core/nailPositions.js`, new). Along the way,
      `weaveMath.js` grew a shared pure `weaveSegmentsForCurve` so `ExportRenderer` doesn't
      duplicate `StringArtRenderer`'s weave loop, only the final p5-vs-p5.Graphics draw calls.
      **Plus** a small, unrelated toggle for step 2's graph-paper backdrop
      (`toggleGraphPaperInput` → `showGraphPaper`) - on-screen only, never affects either export.

## Supporting work done alongside the backlog

Not backlog items themselves, but built in service of them or as follow-up polish:

- [x] Cross-page nav link (`/` ↔ `/freestyle/`).
- [x] Dark-themed submenu form fields (select/text/number inputs) — was default browser white,
      now matches the rest of the UI (applies to both pages).
- [x] Fixed a real bug: clicking the menu while placing points on freestyle added a stray
      out-of-canvas point and drew a line toward it (`touchesMenus()` was checking the wrong page
      coordinates). Also added a canvas-bounds guard as a second line of defense.
- [x] Grid tool's canvas is now also centered and framed on the grey page background (previously
      only freestyle was) — same `css/canvas-frame.css` treatment. The canvas is sized to the
      grid's own bounding box (`Grid#boundingBox()`) plus padding, not the window, so it takes the
      actual shape the current rows/cols produce (square, tall, wide, ...) and the nails fill it
      evenly instead of hugging the top-left corner. No auto-zoom (pan only, zoom stays 1); stays
      centered through a window resize via CSS alone, no `windowResized` handler needed anymore.

## Status legend

`[x]` done and verified · `[~]` partially done, scope noted · `[ ]` not started
