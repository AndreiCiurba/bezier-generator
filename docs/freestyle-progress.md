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
      a bold lighter-grey line every 10 cells, darker-grey minor lines between (`GraphPaperRenderer`
      + pure `graphPaperMath.js`). Drawn in world space, so it pans/zooms with the design.
- [x] **3. Canvas size pre-selection** — preset dropdown (20×20, 30×30, 30×40, 40×40, 50×50 cm)
      + custom width/height fields, centered on screen. **Default: 20×20cm @ 90 DPI** (709×709px).
- [ ] **4. Number of colors pre-selection** — not started. Freestyle still uses the fixed 8-slot
      palette, same as the grid tool.
- [x] **5. Freestyle pattern creation** — click anywhere (no snapping) to place control points;
      Reset/Clear All/Undo, colors, favorites, and patterns (save/select/stamp) all work the same
      as the grid tool, minus the Manual/Auto toggle (nothing to auto-stamp across without a grid).
- [ ] **6. Display with hover — greyed out or not** — not started.
- [ ] **7. V / H / arrow keys for pattern apply** — not started.
- [ ] **8. Drag & drop a pattern point (all copies vs. just one)** — not started.
- [ ] **9. Export image (nails-only, and nails+lines)** — not started.

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
