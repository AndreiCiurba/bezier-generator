import { FreeformShape } from './FreeformShape.js';
import { CardioidShape } from './CardioidShape.js';

/**
 * Rebuilds a saved library shape of either kind: a cardioid from the Cardioid
 * page (`kind: 'cardioid'`) or a Shape Designer outline (no `kind` - every
 * shape saved before cardioids existed).
 */
export function shapeFromJSON(raw) {
  return raw?.kind === 'cardioid' ? CardioidShape.fromJSON(raw) : FreeformShape.fromJSON(raw);
}

/** Passed where a store expects a shape class with a `fromJSON`. */
export const AnyShape = { fromJSON: shapeFromJSON };

export function isCardioid(shape) {
  return shape?.kind === 'cardioid';
}
