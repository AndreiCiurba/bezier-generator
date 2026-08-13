# Epic: Color Picker V2

## Overview

Replace the application's current color-selection experience with a new **Color Picker V2** that supports two selectable modes:

1. **Default** — the existing JavaScript/browser color picker.
2. **Custom** — a new categorized color palette built from application-defined color data.

The user can select any number of layers in the application. When they click a color for a selected layer, the picker behavior depends on the currently selected picker mode.

The custom picker should display colored squares. It must not display color names or subcategory names directly in the palette. The HEX value should be displayed on hover.

The initial color data should be stored in a JSON file inside the project. The Excel file is used as the source for initially populating that JSON data, but the application should not depend on the Excel file at runtime.

---

# User Experience

## Picker Mode

Provide a toggle between:

```text
Default | Custom
```

### Default mode

When the user clicks a color in the existing/main color menu:

- open the normal JavaScript/browser color picker;
- preserve the existing behavior;
- selecting a color updates the selected layer(s) exactly as it currently does.

### Custom mode

When the user clicks a color in the existing/main color menu:

- open the new custom color picker;
- display the categorized palette;
- clicking a color square selects that HEX value;
- update the selected layer(s) with that color;
- update the color shown in the main menu exactly as the default picker currently does.

The custom picker must integrate with the existing layer-selection behavior rather than introducing a separate color-selection mechanism.

---

# Custom Color Picker Layout

The custom picker displays colors grouped by **main category**.

The source data has:

- Column B = main category
- Column C = subcategory
- a HEX value column containing the actual color value.

The main category determines the row.

All colors belonging to that main category are displayed horizontally across that row.

Example:

```text
Category A    ■ ■ ■ ■ ■ ■ ■
Category B    ■ ■ ■ ■
Category C    ■ ■ ■ ■ ■ ■ ■ ■ ■
```

The actual UI should use the main category to determine each row. The palette itself should consist of color squares; category and subcategory names should not be rendered as labels inside the color grid.

The subcategory should be retained in the underlying JSON data for future use, but it should not be rendered as a label in the initial version.

---

# Color Swatches

Each color is represented by a square swatch.

Requirements:

- square shape;
- filled with the exact HEX color;
- no color name displayed;
- no HEX text displayed inside or below the square;
- clicking the square selects that color;
- hovering the square should display the HEX value.

Example:

```text
┌────┐ ┌────┐ ┌────┐ ┌────┐
│████│ │████│ │████│ │████│
└────┘ └────┘ └────┘ └────┘
```

The HEX value is metadata and should be exposed through the hover tooltip.

The UI should provide a clear visual selected/hover state without changing the actual color of the swatch.

---

# Color Selection

Clicking a custom color must behave like selecting a color through the existing/default picker.

Flow:

```text
Select layer(s)
      ↓
Click existing color control
      ↓
Picker mode?
   /        \
Default     Custom
   |           |
JS picker   Custom palette
   |           |
   └─────┬─────┘
         ↓
   Selected HEX
         ↓
Update selected layer(s)
         ↓
Update main color display
```

The custom picker must not introduce a separate representation of the selected color.

The existing application color state should remain the source of truth.

---

# Multi-Layer Selection

The application already allows selecting any number of layers.

The custom picker must work with this existing behavior.

If multiple layers are selected:

1. User opens the color picker.
2. User selects one custom color.
3. The selected color is applied to all selected layers according to the existing application's layer-color behavior.
4. The main color control reflects the resulting selected color state in the same manner as the existing picker.

Do not change the existing multi-layer selection semantics unless necessary for the feature.

---

# Color Data

Create a dedicated JSON data file for the custom palette.

Suggested structure:

```json
[
  {
    "category": "Category A",
    "subcategory": "Subcategory A1",
    "hex": "#FF0000"
  },
  {
    "category": "Category A",
    "subcategory": "Subcategory A2",
    "hex": "#CC0000"
  }
]
```

The exact filename/location should follow the project's existing data conventions.

The important requirement is that the runtime application reads the palette from JSON rather than from Excel.

---

# Excel Import / Initial Data

The supplied Excel file is the initial source for populating the JSON.

Use:

- Column B → `category`
- Column C → `subcategory`
- HEX value column → `hex`

The Excel file itself should not be required by the production application.

After the initial conversion:

```text
Excel
  ↓
initial data extraction
  ↓
JSON
  ↓
Custom Color Picker
```

The JSON becomes the application's source for the custom palette.

Future colors will be manually added to the JSON.

Do **not** implement a recurring Excel import pipeline unless needed during initial development.

---

# Future Color Registration

A future feature may provide a dedicated way to register a color with:

- category;
- subcategory;
- HEX value.

This is explicitly **out of scope for Color Picker V2**.

For now, adding colors means manually editing the JSON file.

The JSON structure should nevertheless make this future extension straightforward.

---

# Responsive Layout

The custom palette should handle categories with different numbers of colors.

For example:

```text
Category A    ■ ■ ■ ■ ■ ■ ■ ■
Category B    ■ ■ ■
Category C    ■ ■ ■ ■ ■
```

Do not force every category to have the same number of columns.

The implementation should choose a sensible layout that keeps colors grouped by category and remains usable within the available picker width.

The palette should avoid unnecessary horizontal overflow where practical.

---

# Interaction and Closing Behavior

The custom picker should behave like a normal color picker control:

- open when the user clicks the existing color control;
- close after selecting a color if that matches the existing picker behavior;
- close when clicking outside if that matches the existing UI conventions;
- preserve the current color when opened;
- not modify the selected color until a color is explicitly chosen.

Do not introduce a second permanent color-selection UI elsewhere in the application.

---

# Visual Integration

The custom picker should visually belong to the existing application.

Reuse existing:

- typography;
- spacing conventions;
- borders;
- shadows;
- sizing;
- interaction patterns.

Do not redesign unrelated parts of the application.

The custom picker should feel like a replacement mode for the existing color picker rather than a completely unrelated feature.

---

# Implementation Steps

Each step should be completed and verified before moving to the next.

The implementation must maintain a progress file throughout development:

```text
COLOR_PICKER_V2_PROGRESS.md
```

The progress file must contain the implementation steps below and track their status.

Use checkboxes such as:

```markdown
- [ ] Step 1 — ...
- [x] Step 2 — ...
```

After completing a step, Claude Code should update the progress file with:

- checkbox status;
- brief summary of what was implemented;
- relevant files changed;
- tests/checks performed;
- any remaining caveats.

Do not mark a step complete until its acceptance criteria are satisfied.

---

## Step 1 — Inspect Existing Color and Layer Architecture

### Goal

Understand how the current color picker, color state, layer selection, and layer updates work before modifying them.

### Tasks

- Locate the existing/default JavaScript color picker.
- Locate the main color control/menu.
- Locate color state/storage.
- Locate layer selection state.
- Locate the code that applies colors to selected layers.
- Determine how the current picker updates the visible main color.
- Identify the appropriate location for the new picker-mode toggle.
- Inspect the supplied Excel file and identify the HEX column.

### Acceptance Criteria

- Existing color flow is documented in the progress file.
- Existing multi-layer behavior is understood.
- No existing color behavior is changed.
- Excel category/subcategory/HEX mapping is confirmed.

---

## Step 2 — Create the Color JSON Data

### Goal

Create the runtime data source for the custom palette.

### Tasks

- Extract the initial color records from the Excel file.
- Map:
  - Column B → category;
  - Column C → subcategory;
  - HEX column → hex.
- Create the project JSON file.
- Preserve the source ordering where practical.
- Validate HEX values.
- Avoid duplicate records unless the source intentionally contains duplicates.

### Acceptance Criteria

- JSON exists in the project.
- JSON contains the initial Excel color data.
- Every record has category, subcategory, and HEX.
- HEX values are valid.
- Application runtime does not require the Excel file.

---

## Step 3 — Add Basic / Custom Picker Toggle

### Goal

Allow the user to choose which picker opens.

### Tasks

- Add a Default/Custom toggle.
- Preserve the existing JavaScript picker as Default mode.
- Store the selected picker mode using the application's existing settings/state conventions if appropriate.
- Connect the existing color control to the selected mode.

### Acceptance Criteria

- Default mode opens the existing JavaScript color picker.
- Custom mode opens the new custom picker placeholder.
- Switching modes does not change the selected color.
- Existing default behavior remains functional.

---

## Step 4 — Build the Custom Palette UI

### Goal

Render the categorized color grid.

### Tasks

- Load the JSON color data.
- Group colors by main category.
- Render one horizontal row per category.
- Render all colors for that category as square swatches.
- Do not render color names.
- Do not render HEX text directly in the palette.
- Keep subcategory data available but do not display it as a visible label.
- Add hover HEX tooltip.
- Add hover/selected visual states.

### Acceptance Criteria

- Every JSON color is rendered.
- Colors are grouped by main category.
- Each category has its own row.
- Swatches are square.
- Swatches display the exact actual color.
- No color names appear.
- No HEX text appears directly in the palette.
- HEX is available on hover.
- Categories with different numbers of colors render correctly.

---

## Step 5 — Connect Custom Picker to Existing Color Selection

### Goal

Make selecting a custom color behave exactly like the existing picker.

### Tasks

- On swatch click, return the HEX value to the existing color-selection flow.
- Update the application's existing color state.
- Apply the color to the selected layer(s).
- Update the main color control/display.
- Close the picker according to existing picker behavior.

### Acceptance Criteria

- Clicking a swatch selects its HEX.
- Selected layer(s) receive the selected color.
- Main color display updates.
- Single-layer selection works.
- Multi-layer selection works.
- No duplicate color state is introduced.

---

## Step 6 — Picker Behavior and UX Integration

### Goal

Make Custom mode behave like a native part of the application.

### Tasks

- Match existing picker open/close behavior.
- Handle outside clicks if appropriate.
- Preserve current color when opening.
- Add selected swatch state if useful.
- Ensure keyboard/focus behavior does not break existing controls.
- Ensure palette remains usable when it contains many colors.

### Acceptance Criteria

- Picker opens/closes predictably.
- Existing application interactions remain functional.
- Current color is not changed accidentally.
- Custom picker visually integrates with the application.

---

## Step 7 — Regression and Edge-Case Testing

### Goal

Verify that Color Picker V2 does not break existing behavior.

### Test Cases

- Default picker + one selected layer.
- Default picker + multiple selected layers.
- Custom picker + one selected layer.
- Custom picker + multiple selected layers.
- Switching Default → Custom.
- Switching Custom → Default.
- Selecting the currently active color.
- Selecting colors from every category.
- Categories with one color.
- Categories with many colors.
- Reopening the picker after selection.
- Closing without selecting a color.
- Invalid/missing JSON entries, where applicable.
- Browser resize/layout behavior.

### Acceptance Criteria

- Existing Default picker behavior remains unchanged.
- Custom picker correctly updates colors.
- Multi-layer behavior remains correct.
- No console/runtime errors are introduced.
- No unrelated UI behavior regresses.

---

## Step 8 — Final Cleanup and Documentation

### Goal

Leave the implementation maintainable for future color additions.

### Tasks

- Remove temporary/debug code.
- Ensure JSON location and structure are clear.
- Document how to manually add a new color.
- Ensure the progress file is complete.
- Verify production behavior.
- Summarize files changed.

### Acceptance Criteria

- No unnecessary code remains.
- JSON is easy to extend manually.
- Future developers can add a color using category/subcategory/HEX.
- Progress file accurately reflects implementation status.
- Feature is ready for production.

---

# Out of Scope

Do not implement in this Epic:

- automatic Excel loading at runtime;
- automatic synchronization with Excel;
- a color registration UI;
- editing/deleting colors through the application;
- color names in the picker;
- visible HEX values in the picker;
- subcategory labels in the initial UI;
- advanced color search/filtering;
- color sorting controls;
- favorites/recent colors unless already provided by the existing application;
- changes to unrelated color-management functionality.

---

# Future Extension: Color Registration

A future Epic/step may introduce a color-registration flow:

```text
Register Color
    ↓
Category
Subcategory
HEX
    ↓
Validate
    ↓
Add to palette JSON
```

Color Picker V2 should keep the data structure compatible with this future functionality without implementing it now.

---

# Definition of Done

Color Picker V2 is complete when:

1. The user can choose between Default and Custom picker modes.
2. Default mode opens the existing JavaScript color picker.
3. Custom mode opens the new categorized palette.
4. The custom palette is populated from project JSON data.
5. The initial JSON data is based on the supplied Excel file.
6. Each main category is rendered as a row.
7. Colors within a category are displayed horizontally.
8. Each color is represented only by its actual colored square.
9. No color name or HEX text is displayed in the palette.
10. HEX is available as a hover tooltip.
11. Clicking a color updates the existing application color state.
12. The selected color is applied to all currently selected layers according to existing behavior.
13. The main color control updates exactly as it does with the default picker.
14. Existing Default picker behavior is not broken.
15. The palette works with varying category sizes.
16. The JSON can be manually extended with new category/subcategory/HEX records.
17. `COLOR_PICKER_V2_PROGRESS.md` accurately tracks all implementation steps.
18. The final progress file records completed work, changed files, tests/checks, and remaining caveats.
