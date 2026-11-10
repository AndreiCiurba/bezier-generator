/**
 * Checks whether a closed leap weave will actually show every color layer.
 *
 * With `nailCount` nails in a loop, color layer `i` (0-based) ties each nail to
 * the one `step = 1 + leap - i` places further round (see
 * `closedWeaveMath.js`). Two things go wrong:
 *  - a step that is a whole number of laps (0, +-N, ...) joins a nail to
 *    itself, so that layer draws nothing ("empty");
 *  - a step of `s` and a step of `N - s` (or `-s`) draw exactly the same
 *    strings, so the later one hides under the earlier ("duplicate").
 * Only `floor(N / 2)` different, visible layers exist for N nails.
 */

function mod(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

/** Layer `layerIndex`'s step round the nail loop, as closedWeaveMath uses it. */
export function layerStep(leap, layerIndex) {
  return 1 + leap - layerIndex;
}

/** The step folded to 0..N/2: steps that draw the same strings share one value; 0 means "joins a nail to itself". */
function foldedStep(step, nailCount) {
  const m = mod(step, nailCount);
  return Math.min(m, nailCount - m);
}

/**
 * @param {{nailCount:number, leap:number, enabled:boolean[]}} params `enabled[i]` is whether color layer i is drawn
 * @returns {{kind:'empty'|'duplicate', layer:number, of?:number}[]} one entry per problem layer (0-based layer numbers; `of` is the earlier layer a duplicate repeats). Empty when every drawn layer is distinct and visible.
 */
export function findLeapProblems({ nailCount, leap, enabled }) {
  const problems = [];
  const firstLayerWithStep = new Map();
  enabled.forEach((isOn, layer) => {
    if (!isOn) return;
    const folded = foldedStep(layerStep(leap, layer), nailCount);
    if (folded === 0) {
      problems.push({ kind: 'empty', layer });
    } else if (firstLayerWithStep.has(folded)) {
      problems.push({ kind: 'duplicate', layer, of: firstLayerWithStep.get(folded) });
    } else {
      firstLayerWithStep.set(folded, layer);
    }
  });
  return problems;
}

/**
 * The leap closest to `leap` that makes every drawn layer distinct and
 * visible, or null when the nails can't fit that many layers (needs
 * nailCount >= 2 * layers).
 * @param {{nailCount:number, leap:number, enabled:boolean[]}} params
 * @returns {number|null}
 */
export function suggestLeap({ nailCount, leap, enabled }) {
  let best = null;
  // Steps repeat every `nailCount`, so leaps this far either side of the current one cover everything.
  for (let offset = 0; offset <= nailCount; offset++) {
    for (const candidate of offset === 0 ? [leap] : [leap - offset, leap + offset]) {
      if (findLeapProblems({ nailCount, leap: candidate, enabled }).length === 0) {
        best = candidate;
        break;
      }
    }
    if (best !== null) break;
  }
  return best;
}
