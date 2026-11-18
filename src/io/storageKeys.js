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

/**
 * The real thread setup (thread width, nail width, 8/O wrap), shared by
 * `/arrange/` and `/cardioid/` - one physical thread and nail set, so changing
 * it on either page changes both. The value keeps its original Arrange-only
 * name so earlier saves still load.
 */
export const THREAD_STORAGE_KEY = 'arrangeThread:v1';

/** Cardioids saved on `/cardioid/` - read (and deletable) on `/arrange/` alongside the Shape Designer library. */
export const CARDIOID_LIBRARY_STORAGE_KEY = 'cardioidLibrary:v1';
