# Color Picker V2 — progress tracker

Tracks implementation of [color_picker_v2_epic.md](color_picker_v2_epic.md). See
`C:\Users\Andrei\.claude\plans\encapsulated-crafting-castle.md` (the approved implementation plan)
for the full design rationale.

## Scoping decisions (confirmed before any code was written)

- **Excel column mismatch.** The epic assumed column B = category, column C = subcategory. The
  real `docs/Color_Database_.xlsx` sheet is `A=Thread ID, B=Color Category, C=Hex Code,
  D=Availability(h/l), E=Brand/Name, F=Color Code` — there is no subcategory column. Per the user:
  don't care about subcategory — colors just need to display grouped horizontally by main
  category, categories stacked vertically. `subcategory` is written as `""` for every JSON record;
  the field stays in the schema for future manual use.
- **No multi-layer selection exists in this app.** Color state lives in `StrokePalette`
  (`src/state/StrokePalette.js`), a fixed array of slots, each with its own permanent,
  always-visible swatch (`src/ui/ColorPickerUI.js`, one native `<input type="color">` per slot).
  There's no "select layer(s), then click a shared color control" flow to preserve. Custom mode
  makes **each individual swatch** open the categorized popover instead of the OS picker, setting
  just that one slot — the direct equivalent of what Default mode already does per swatch.
- **Applies to all three pages** — the main grid app (`index.html`/`App.js`), Freestyle
  (`freestyle/`/`FreestyleApp.js`), and the 3D visualizer (`3d/`/`ThreeApp.js`) — all three already
  share the identical `ColorPickerUI`/`StrokePalette` wiring.
- **Mode toggle persists via `localStorage`** (key `stringArt.colorPickerMode`) — the first use of
  localStorage in this codebase; every other piece of app state here is in-memory-only per session.

## Steps

- [x] **Step 1 — Inspect existing color and layer architecture**
  - Native picker: `src/ui/ColorPickerUI.js` creates one `<input type="color">` per `StrokePalette`
    slot in `rebuild()`; left-click (`input` event) → `palette.setColor(index, value)`; right-click
    → `palette.toggleEnabled(index)`.
  - Color state source of truth: `src/state/StrokePalette.js` — plain class, `#slots` array of
    `{color, enabled}`, manual `onChange` pub/sub, no framework.
  - "Layer" == palette slot index throughout this codebase (confirmed via comments in
    `ColorPickerUI.js`, `ThreeApp.js`, `weaveMath.js`) — there is no separate multi-select layer
    concept; each swatch is already its own independent control.
  - Color→layer apply path: `picker.addEventListener('input', ...)` → `StrokePalette#setColor` →
    `#notify()` → `onChange` subscribers (only the 3D page subscribes, to recolor live pattern
    curves; the 2D pages just re-read `palette.getAll()` every draw-loop frame).
  - Main-swatch sync point for programmatic color changes: `ColorPickerUI#syncPicker(index)`,
    already used by `FavoritesUI#applyBundle`.
  - Toggle location: a new `#colorPickerModeToggle` div directly above `#colorPickerContainer` in
    all 3 HTML entry points, matching the existing Manual/Auto toggle-button convention
    (`src/ui/PatternUI.js`, `#toggleBtn`).
  - Excel inspected directly (stdlib `zipfile`+`xml.etree`, no `openpyxl` available): 205 real
    records, 19 categories, rows 2–208 (rest of the 999-row sheet is blank), no duplicate
    `(category, hex)` pairs, all hex values well-formed.
  - No existing color behavior was changed by this inspection step.

- [x] **Step 2 — Create the color JSON data**
  - `src/data/customPalette.json` generated from `docs/Color_Database_.xlsx` via a one-off,
    not-committed conversion script (stdlib-only Python; re-run manually if the spreadsheet is
    ever re-imported). 205 records, `{category, subcategory: "", hex}`, source row order preserved,
    hex lowercased and validated against `/^#[0-9a-f]{6}$/i`. Zero duplicates/invalid entries found.
  - Runtime loading (`src/state/customPaletteData.js`) uses `fetch(new URL('../data/customPalette.json', import.meta.url))`
    — module-relative, so it resolves correctly from all three page depths — not a static import,
    so the app has no build-time dependency on the xlsx file or an import-assertion syntax.
  - Tests: `src/state/customPaletteData.test.js` (grouping logic + the real 205-record file: 19
    categories, no colors dropped, every hex well-formed).

- [x] **Step 3 — Add Basic/Custom picker toggle**
  - `src/state/pickerMode.js` — pure `getPickerMode`/`setPickerMode`/`isValidPickerMode`, backed by
    `localStorage`, default `'default'`, never throws (falls back silently if storage is
    unavailable/corrupted).
  - `src/ui/PickerModeUI.js` — wires the two toggle buttons, persists the mode, and calls
    `colorPickerUI.rebuild()` so swatches immediately switch element type.
  - Wired into `App.js`, `FreestyleApp.js`, `ThreeApp.js` right after each page's existing
    `ColorPickerUI` construction.
  - Switching modes never touches `StrokePalette` — only which element type `rebuild()` creates.
  - Tests: `src/state/pickerMode.test.js` (7 tests: validation, round-trip, invalid-value fallback,
    unavailable-storage safety).

- [x] **Step 4 — Build the custom palette UI**
  - `src/ui/CustomColorPopover.js` — one shared popover per `ColorPickerUI` instance; renders one
    `.custom-palette-row` per category (source order via `groupByCategory`), one square `.color-btn`
    per color, `title = hex` for the hover tooltip (same pattern `FavoritesUI` already uses for its
    bundle swatches) — no category/subcategory text and no hex text rendered anywhere in the grid.
  - Reuses the existing `.color-btn` class (`css/colors.css`, originally built for favorite-bundle
    rows) for the swatches themselves; new `css/customPalette.css` adds popover chrome (reusing
    `--panel-bg-submenu`/`--panel-radius`/`--panel-shadow-submenu`/`--ui-font-family` tokens) and
    fixed swatch sizing (overriding `.color-btn`'s flex-fill, which was tuned for `.bundle` rows).
  - All 205 colors across all 19 categories render; verified via the `groupByCategory` unit tests
    against the real JSON (widest category: Orange Dark, 17 colors; narrowest: Golden/Neon, 6).

- [x] **Step 5 — Connect custom picker to existing color selection**
  - `ColorPickerUI#rebuild()` now branches on `getPickerMode()`: Default creates the exact same
    `<input type="color">` as before (untouched code path); Custom creates a `<button class="color-btn">`
    swatch whose click opens `CustomColorPopover.openFor(swatch, onSelect)`.
  - The popover's `onSelect(hex)` callback is exactly `palette.setColor(index, hex)` followed by
    `syncPicker(index)` — the same call the native `<input>` path already makes, so there is no
    second/parallel color-state representation.
  - `syncPicker(index)` now branches on element tag (`INPUT` → `.value`; `BUTTON` → `.style.backgroundColor`
    + `.title`) so `FavoritesUI#applyBundle` keeps working unmodified in either mode.
  - Right-click enable/disable toggle preserved identically for both swatch types
    (`#wireEnabledToggle`/`#updateEnabledVisual`, unchanged logic, now shared instead of duplicated).

- [x] **Step 6 — Picker behavior and UX integration**
  - Popover opens anchored below (or above, if it would overflow the viewport bottom) the clicked
    swatch, clamped horizontally to stay on-screen.
  - Outside-click (`mousedown`, capture phase) and `Escape` both close it — a new interaction
    pattern for this app (no existing panel here closes on outside-click; documented inline in
    `CustomColorPopover.js` since there's no precedent to point to).
  - Opening never mutates any color — only an explicit swatch click inside the popover does.
  - No changes to any other panel's open/close/focus behavior (`Panel`/`PanelGroup` untouched).

- [x] **Step 7 — Regression and edge-case testing**
  - Automated: full Vitest suite (270 tests, 40 files) passes, including new tests for
    `pickerMode.js`, `customPaletteData.js`, `categoryLeadColors.js`, and the updated
    `StrokePalette.test.js`.
  - Manual in-browser verification (user explicitly requested it, overriding the `no-e2e` default)
    via a local static server (`python -m http.server`) driven through the Chrome extension, across
    all three pages (`index.html`, `freestyle/index.html`, `3d/index.html`):
    - Default mode: 8 native `<input type="color">` swatches, seeded from the new category lead
      colors (verified exact hex match against `CATEGORY_LEAD_COLORS[0..7]`).
    - Switching to Custom mode: swatches become `<button class="color-btn">`, same colors preserved
      (mode switch never touched palette state), same 15px sizing as the native input.
    - Custom popover: all 19 category rows render, 205 total swatches, per-category counts matched
      exactly against the known distribution (13,15,7,12,16,7,9,8,13,14,17,13,6,10,10,6,8,10,11);
      swatch size confirmed at 12.6px / 3px border-radius (the 30%-smaller sizing); `title` hex
      tooltip present; no category/subcategory/hex text rendered anywhere in the grid.
    - Clicking a popover swatch: closed the popover, updated the correct `StrokePalette` slot
      (confirmed via `getSlot(index).color`), and synced the main swatch's background + tooltip.
    - Outside-click closed the popover without changing any color.
    - Picker-mode persistence: set to Custom, reloaded the page, mode was still Custom
      (`localStorage['stringArt.colorPickerMode']`); confirmed shared across all 3 pages (same
      origin).
    - `read_console_messages` showed zero console messages (no errors/warnings) across the whole
      session on all three pages.

- [ ] **Step 8 — Final cleanup and documentation**
  - "How to add a color" note still to be written (edit `src/data/customPalette.json` directly:
    `{ "category": "...", "subcategory": "", "hex": "#rrggbb" }`).
  - Final file-changed summary and caveats still to be written once Step 7's manual pass is done.

## Post-Step-6 follow-up (requested by user)

- **Layer default colors now come from the custom palette.** `src/data/categoryLeadColors.js`
  holds each category's first hex, in source order (derived from `customPalette.json`, checked in
  as a plain synchronous constant so `StrokePalette` doesn't need to `fetch()` before it can
  construct its initial slots). `StrokePalette`'s `DEFAULT_COLORS` and its `resize()` growth-fill
  now both cycle through `leadColorForIndex(index)` instead of the old hardcoded 8-color array /
  `randomHexColor` - slot 0 gets category 0's lead color, slot 1 gets category 1's, ..., and once a
  palette grows past 19 slots (the category count) it cycles back to category 0. This applies to
  every new slot regardless of picker mode (Default or Custom) - it changes what a new layer starts
  as, not which control opens when you click it. Tests: `src/data/categoryLeadColors.test.js` (3
  tests: shape, direct mapping, cycling), plus `src/state/StrokePalette.test.js` updated (one test
  renamed to describe the new default, one new test asserting `resize` passes each new slot its own
  absolute index so repeated grows continue the same cycle rather than restarting it).
- **Popover swatches sized down 30%.** `.custom-palette-popover .color-btn` went from 18px to
  12.6px (and its border-radius scaled proportionally, 4px → 3px) in `css/customPalette.css`. The
  main color row's per-slot swatch size (15px, matching the native picker) is unchanged - only the
  popover's own grid shrank.

## Files changed so far

**New:** `src/data/customPalette.json`, `src/data/categoryLeadColors.js` (+test), `src/state/pickerMode.js`
(+test), `src/state/customPaletteData.js` (+test), `src/ui/CustomColorPopover.js`, `src/ui/PickerModeUI.js`,
`css/customPalette.css`, `docs/COLOR_PICKER_V2_PROGRESS.md`.

**Modified:** `src/ui/ColorPickerUI.js`, `src/state/StrokePalette.js` (+test), `src/app/App.js`,
`src/freestyle/FreestyleApp.js`, `src/three-page/ThreeApp.js`, `index.html`, `freestyle/index.html`,
`3d/index.html`, `css/tokens.css`.

## Caveats

- The xlsx→JSON conversion script was intentionally **not committed** (per the epic: "do not
  implement a recurring Excel import pipeline"). Re-generating `customPalette.json` from a future
  updated spreadsheet currently requires re-writing that one-off script.
- Browser verification (Step 7) covered rendering, selection, persistence, and console cleanliness,
  but not the "reopening after selection" and "browser resize/layout" edge cases from the epic's
  test-case list in detail, nor the Freestyle/3D pages' full curve-drawing + recolor flow end to
  end (only the picker itself and its direct effect on `StrokePalette`/3D live-recolor state).
