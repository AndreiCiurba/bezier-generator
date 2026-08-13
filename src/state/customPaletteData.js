/**
 * Loads the custom color palette (src/data/customPalette.json - see that
 * file's header comment for its origin/shape) and groups it by category for
 * the custom picker's row-per-category layout.
 *
 * Fetched via a module-relative URL (`new URL(..., import.meta.url)`)
 * rather than a page-relative path, so this works unmodified from any of
 * the app's three HTML entry points (index.html, freestyle/index.html,
 * 3d/index.html) despite them living at different directory depths.
 */

const DATA_URL = new URL('../data/customPalette.json', import.meta.url);

let cachedRecords = null;

/**
 * Fetches and caches the palette records. Safe to call repeatedly - only
 * the first call hits the network.
 * @returns {Promise<Array<{category: string, subcategory: string, hex: string}>>}
 */
export async function loadCustomPalette() {
  if (cachedRecords) return cachedRecords;
  const response = await fetch(DATA_URL);
  if (!response.ok) {
    throw new Error(`Failed to load custom palette: ${response.status} ${response.statusText}`);
  }
  const records = await response.json();
  cachedRecords = records.filter(isValidRecord);
  return cachedRecords;
}

const HEX_RE = /^#[0-9a-f]{6}$/i;

/** A record is only usable if it has a non-empty category and a well-formed hex - malformed/incomplete manual edits shouldn't crash the picker. */
function isValidRecord(record) {
  return (
    record &&
    typeof record.category === 'string' &&
    record.category.length > 0 &&
    typeof record.hex === 'string' &&
    HEX_RE.test(record.hex)
  );
}

/**
 * Groups records by `category`, preserving first-seen category order and
 * each category's internal record order (both trace back to the source
 * spreadsheet's row order - see the epic's "preserve source ordering"
 * requirement). Pure function, no fetch - takes records so it's directly
 * unit-testable against fixture data.
 * @param {Array<{category: string, subcategory: string, hex: string}>} records
 * @returns {Array<{category: string, colors: Array<{subcategory: string, hex: string}>}>}
 */
export function groupByCategory(records) {
  const order = [];
  const byCategory = new Map();

  for (const record of records) {
    if (!byCategory.has(record.category)) {
      byCategory.set(record.category, []);
      order.push(record.category);
    }
    byCategory.get(record.category).push({ subcategory: record.subcategory ?? '', hex: record.hex });
  }

  return order.map((category) => ({ category, colors: byCategory.get(category) }));
}
