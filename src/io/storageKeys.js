/**
 * Shared `BrowserStorage.js` key names - defined once so `/shapes/` and
 * `/arrange/` (which both read/write `SHAPE_LIBRARY_STORAGE_KEY`) can never
 * drift apart into two separately hand-typed string literals.
 */

/** The Shape Designer's committed shape library - written by `/shapes/`, read (but never written) by `/arrange/`. */
export const SHAPE_LIBRARY_STORAGE_KEY = 'shapeLibrary:v1';

/** The Arrange board's placed instances - owned entirely by `/arrange/`. */
export const ARRANGEMENT_STORAGE_KEY = 'arrangement:v1';

/** The Shape Designer's in-progress (not-yet-committed) shape, so an accidental reload doesn't lose it. */
export const SHAPE_DRAFT_STORAGE_KEY = 'shapeDraft:v1';
