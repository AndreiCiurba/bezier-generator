/**
 * The first hex color of each category in customPalette.json, in source
 * (spreadsheet) order. Used to seed each new palette slot's default color
 * (StrokePalette) with a real, curated color instead of an arbitrary
 * hardcoded/random one - see StrokePalette's DEFAULT_COLORS and `resize`.
 *
 * Derived data, checked in (not computed at runtime): StrokePalette is
 * constructed synchronously, before anything has had a chance to
 * `fetch()` customPalette.json (see customPaletteData.js), so this can't
 * just be read from the JSON at that point. Regenerate by grouping
 * customPalette.json by category (customPaletteData.js#groupByCategory)
 * and taking each group's first hex, if the source data changes in a way
 * that should be reflected here (new category, reordered categories, or a
 * category's first color changes).
 */
export const CATEGORY_LEAD_COLORS = [
  '#1b2f29', // Green Dark
  '#cbf100', // Green Light
  '#85e9ff', // Turquoise
  '#2e2852', // Blue Dark
  '#acbeee', // Blue Light
  '#5b3bc7', // Purple Blue
  '#a280cf', // Purple Light
  '#6a3c96', // Purple Red
  '#683833', // Red Dark
  '#eb5857', // Red Light
  '#fd9100', // Orange Dark
  '#f4b300', // Orange Light
  '#ebcd95', // Golden
  '#fff200', // Yellow Dark
  '#ecddcf', // Yellow Light
  '#c9f100', // Neon
  '#f8a98f', // Peach
  '#ff8fad', // Pink
  '#c4828f', // Others
];

/**
 * The lead color for palette slot `index` (0-based), cycling back to the
 * first category once `index` reaches the category count - e.g. index 19
 * (the 20th slot) reuses category 0's lead color, index 20 reuses category
 * 1's, and so on.
 * @param {number} index
 * @returns {string} a hex color
 */
export function leadColorForIndex(index) {
  return CATEGORY_LEAD_COLORS[index % CATEGORY_LEAD_COLORS.length];
}
