/**
 * A page's settings with whatever was saved for them laid over the defaults -
 * only keys the defaults have, and only values of the same kind (a finite
 * number for a number, ...), so an old or damaged save can never break the
 * page or smuggle in unknown fields.
 * @template {Record<string, unknown>} T
 * @param {T} defaults
 * @param {unknown} saved
 * @returns {T}
 */
export function mergeSavedSettings(defaults, saved) {
  const merged = { ...defaults };
  if (!saved || typeof saved !== 'object') return merged;
  for (const [key, fallback] of Object.entries(defaults)) {
    const value = saved[key];
    if (typeof value !== typeof fallback) continue;
    if (typeof value === 'number' && !Number.isFinite(value)) continue;
    merged[key] = value;
  }
  return merged;
}
