import { describe, it, expect } from 'vitest';
import { mergeSavedSettings } from './mergeSavedSettings.js';

const defaults = { boardWidth: 12000, color: '#8a784e', nailsVisible: true };

describe('mergeSavedSettings', () => {
  it('brings back what was saved, so a page opens the way it was left', () => {
    expect(mergeSavedSettings(defaults, { boardWidth: 6000, color: '#000000', nailsVisible: false }))
      .toEqual({ boardWidth: 6000, color: '#000000', nailsVisible: false });
  });

  it('keeps the default for anything missing, of the wrong kind or unknown, so an old save never breaks the page', () => {
    expect(mergeSavedSettings(defaults, { boardWidth: 'wide', color: null, extra: 1, nailsVisible: NaN }))
      .toEqual(defaults);
    expect(mergeSavedSettings(defaults, { boardWidth: Infinity })).toEqual(defaults);
    expect(mergeSavedSettings(defaults, null)).toEqual(defaults);
  });
});
