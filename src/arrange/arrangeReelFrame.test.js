import { describe, it, expect } from 'vitest';
import { resolveArrangeFrame, outlineAnchors, borderLayers, nailClashes, flyCrashes, flyFraming } from './arrangeReelFrame.js';

const petalRing = {
  weave: { drawProgress: { keyframes: [{ t: 0, value: 0 }, { t: 1, value: 1 }] } },
  shapes: [
    {
      outline: { type: 'petal' }, size: 500, nails: 20, leap: 0, palette: ['#ff0000', '#0000ff'], layers: 3,
      repeat: { count: 4, radius: 1000, stagger: 0.1 }, window: [0, 0.6],
    },
  ],
};

describe('outlineAnchors', () => {
  it('gives every preset at least the three anchors a closed outline needs', () => {
    for (const type of ['circle', 'oval', 'polygon', 'star', 'heart', 'petal']) {
      expect(outlineAnchors({ type }).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('builds a star with two anchors per point (tip and notch)', () => {
    expect(outlineAnchors({ type: 'star', points: 7 })).toHaveLength(14);
  });
});

describe('resolveArrangeFrame', () => {
  it('expands a repeat into its copies, each with its own nails', () => {
    const frame = resolveArrangeFrame(petalRing, 1);
    expect(frame.nails).toHaveLength(4 * 20);
  });

  it('strings a copy only during its own staggered window, so a ring of petals builds one after another', () => {
    const frame = resolveArrangeFrame(petalRing, 0.05);
    expect(frame.nails.length).toBe(20); // copy 0 started (window 0..0.6), copy 1 not yet (0.1..0.7)
  });

  it('raises the nails before any string goes on', () => {
    const early = resolveArrangeFrame(petalRing, 0.03);
    expect(early.segments).toHaveLength(0);
    expect(early.nails.every((n) => n.h > 0)).toBe(true);
  });

  it('places a repeated copy at its ring radius', () => {
    const frame = resolveArrangeFrame({ shapes: [{ outline: { type: 'circle' }, size: 10, nails: 8, repeat: { count: 1, radius: 1000, phase: 0 } }] }, 1);
    const cx = frame.nails.reduce((s, n) => s + n.x, 0) / frame.nails.length;
    expect(cx).toBeCloseTo(1000, 0);
  });

  it('frames the camera in units of half the board unless the recipe says otherwise', () => {
    const frame = resolveArrangeFrame({ board: { size: 8000 }, camera: { distance: 1, elevation: 0, azimuth: 0 }, shapes: [] }, 0);
    expect(frame.camera.position.x).toBeCloseTo(4000);
  });

  it('hides the board when the recipe sets board to false', () => {
    expect(resolveArrangeFrame({ board: false, shapes: [] }, 0).board).toBeNull();
  });

  it('marks each color band with a thicker border string round the outline, so tiers read as edges over a soft fill', () => {
    const shape = { outline: { type: 'circle' }, nails: 30, leap: 10, palette: ['#111111', '#222222'], colorMode: 'bands', layers: 8, weight: 0.5, border: { weight: 3 } };
    const frame = resolveArrangeFrame({ board: false, weave: { drawProgress: 1 }, shapes: [shape] }, 1);
    const borders = frame.segments.filter((s) => s.weight === 3);
    expect(borders.length).toBe(2 * 30);
    expect(new Set(borders.map((s) => s.color))).toEqual(new Set(['#111111', '#222222']));
    expect(frame.segments.filter((s) => s.weight === 0.5).length).toBeGreaterThan(0);
  });

  it('strings a border only as far as its own layer is strung', () => {
    const shape = { outline: { type: 'circle' }, nails: 30, leap: 10, palette: ['#111111'], layers: 2, border: { layers: 'top' } };
    const frame = resolveArrangeFrame({ board: false, weave: { drawProgress: 0.4 }, shapes: [shape] }, 0);
    expect(frame.segments.filter((s) => s.weight === 2.5).length).toBe(0);
  });
});

describe('making-of', () => {
  const shape = { outline: { type: 'circle' }, nails: 20, leap: 5, palette: ['#ffffff'], layers: 2, height: 100, nailMode: 'hammer', nailShare: 0.5 };
  const at = (progress) => resolveArrangeFrame({ board: { color: { keyframes: [{ t: 0, color: '#000000' }, { t: 1, color: '#ffffff' }] } }, weave: { drawProgress: progress }, shapes: [shape] }, progress);

  it('hammers nails in one after another, each set down proud and driven to its height, before any string goes on', () => {
    const early = at(0.2);
    expect(early.nails.length).toBeGreaterThan(0);
    expect(early.nails.length).toBeLessThan(20);
    expect(early.segments.length).toBe(0);
    const done = at(0.5);
    expect(done.nails.length).toBe(20);
    expect(done.nails.every((n) => Math.abs(n.h - 100) < 1e-9)).toBe(true);
  });

  it('lets the board color change over the clip, for the board being painted', () => {
    expect(at(0).board.color).not.toBe(at(1).board.color);
  });

  const tools = (progress, making = {}) =>
    resolveArrangeFrame({ board: false, making, weave: { drawProgress: progress }, shapes: [shape] }, progress).making;

  it('puts a hammer on the nail going in while a figure is being nailed, and none once it is', () => {
    const nailing = tools(0.2);
    expect(nailing.hammers).toHaveLength(1);
    // Mid-blow the nail still stands proud, so the hammer meets it above its final height.
    expect(nailing.hammers[0].top).toBeGreaterThanOrEqual(100);
    expect(tools(0.75).hammers).toHaveLength(0);
  });

  it('lays the string going on with a spool at its end, and puts it away when the figure is strung', () => {
    const stringing = tools(0.76);
    expect(stringing.spools).toHaveLength(1);
    expect(stringing.spools[0].color).toBe('#ffffff');
    expect(tools(1).spools).toHaveLength(0);
    expect(tools(0.76, { spool: false }).spools).toHaveLength(0);
  });

  it('shows no tools at all unless the recipe asks for the making-of', () => {
    expect(resolveArrangeFrame({ board: false, weave: { drawProgress: 0.2 }, shapes: [shape] }, 0.2).making).toBeNull();
  });
});

describe('borderLayers', () => {
  it('picks the top layer of every run of one color by default, wherever the color changes', () => {
    const bands = [...Array(10).fill('#a'), ...Array(10).fill('#b'), ...Array(10).fill('#c'), ...Array(10).fill('#d')];
    expect(borderLayers(undefined, bands)).toEqual([9, 19, 29, 39]);
    expect(borderLayers(undefined, ['#a', '#a', '#b', '#a', '#a'])).toEqual([1, 2, 4]);
    expect(borderLayers('top', bands)).toEqual([39]);
  });
});

describe('nailClashes', () => {
  const circle = (x, extra = {}) => ({ outline: { type: 'circle' }, size: 1000, nails: 24, leap: 7, layers: 4, palette: ['#ff0000'], x, height: 600, ...extra });

  it('finds nothing for figures that stand apart, because then the board can be built exactly as drawn', () => {
    expect(nailClashes({ shapes: [circle(-1500), circle(1500)] }).clashes).toEqual([]);
  });

  it("flags a figure whose strings run through another figure's nails, which would catch the thread and bend its curve", () => {
    const { clashes } = nailClashes({ shapes: [circle(-400), circle(400)] });
    expect(clashes.some((c) => c.kind === 'string')).toBe(true);
  });

  it('lets a small figure nest inside a big one when the big one is strung above the small one on longer nails', () => {
    const outer = circle(0, { size: 2000, leap: 0, base: 800, height: 600 }); // leap 0 under the center rule: chords run across the middle
    const inner = circle(0, { size: 500, height: 500 });
    expect(nailClashes({ shapes: [outer, inner] }).clashes).toEqual([]);
    expect(nailClashes({ shapes: [{ ...outer, base: 0 }, inner] }).clashes.length).toBeGreaterThan(0);
  });

  it('flags two figures whose nails stand in the same spot', () => {
    const { clashes } = nailClashes({ shapes: [circle(-1000), circle(1000)] });
    expect(clashes.filter((c) => c.kind === 'nails')).toHaveLength(1);
  });
});

describe('flyCrashes', () => {
  const ring = { shapes: [{ outline: { type: 'circle' }, size: 1000, nails: 12, layers: 2, palette: ['#ff0000'], height: 600 }] };

  it('flags a drone path that runs straight through a nail, and passes one that threads between them', () => {
    const fly = (y) => ({ ...ring, camera: { fly: { path: [{ t: 0, x: -0.5, y, h: 0.01 }, { t: 1, x: 0.5, y, h: 0.01 }] } } });
    // unit is 6000 (half the default board); the ring's nails at y = 0 sit at x = +-1000.
    expect(flyCrashes(fly(0)).some((c) => c.what === 'nail')).toBe(true);
    expect(flyCrashes(fly(0.04))).toEqual([]);
  });

  it('flags a path that dips under the board', () => {
    const recipe = { ...ring, camera: { fly: { path: [{ t: 0, x: -0.5, y: 0.5, h: 0.1 }, { t: 1, x: 0.5, y: 0.5, h: -0.1 }] } } };
    expect(flyCrashes(recipe).some((c) => c.what === 'board')).toBe(true);
  });
});

describe('weave.layerSpacing', () => {
  it('starts every figure at the board and stacks its layers at one shared pitch, so a small figure is just a shorter stack of the same threads', () => {
    const shape = (layers, extra = {}) => ({ outline: { type: 'circle' }, size: 500, nails: 12, leap: 0, palette: ['#ff0000'], layers, ...extra });
    const frame = resolveArrangeFrame({ weave: { layerSpacing: 20 }, shapes: [shape(3, { x: -2000, base: 900 }), shape(50, { x: 2000 })] }, 1);
    const lowest = (left) => Math.min(...frame.segments.filter((s) => (s.a.x < 0) === left).map((s) => s.a.h));
    const highest = (left) => Math.max(...frame.segments.filter((s) => (s.a.x < 0) === left).map((s) => s.a.h));
    expect(lowest(true)).toBeCloseTo(20);
    expect(lowest(false)).toBeCloseTo(20);
    expect(highest(true)).toBeCloseTo(60);
    expect(highest(false)).toBeCloseTo(1000);
  });
});

describe('irregular shapes', () => {
  it('makes a blob outline organic rather than round, and the same seed always gives the same blob', () => {
    const radii = (seed) => outlineAnchors({ type: 'blob', lobes: 3, wobble: 0.3, seed }).map((p) => Math.hypot(p.x, p.y));
    const r = radii(4);
    expect(Math.max(...r) - Math.min(...r)).toBeGreaterThan(0.2);
    expect(radii(4)).toEqual(r);
    expect(radii(5)).not.toEqual(r);
  });

  it('lets a ring of copies grow, spiral and climb copy by copy instead of repeating one shape identically', () => {
    const recipe = {
      weave: { layerSpacing: 10 },
      shapes: [{ outline: { type: 'circle' }, size: 200, nails: 12, leap: 0, palette: ['#ff0000'], layers: 4, repeat: { count: 3, radius: 1000, radiusStep: 500, grow: 1.5, layersStep: 4 } }],
    };
    const frame = resolveArrangeFrame(recipe, 1);
    const nailsOf = (k) => frame.nails.slice(k * 12, k * 12 + 12);
    const center = (ns) => Math.hypot(ns.reduce((s, n) => s + n.x, 0) / ns.length, ns.reduce((s, n) => s + n.y, 0) / ns.length);
    const spread = (ns) => Math.max(...ns.map((n) => n.x)) - Math.min(...ns.map((n) => n.x));
    expect(center(nailsOf(2))).toBeGreaterThan(center(nailsOf(0)) + 900);
    expect(spread(nailsOf(2))).toBeGreaterThan(spread(nailsOf(0)) * 2);
    expect(nailsOf(2)[0].h).toBeGreaterThan(nailsOf(0)[0].h);
  });
});

describe('per-shape nail thickness', () => {
  it("passes a shape's own nail thickness to its nails, so small figures can have slimmer nails than the big one", () => {
    const frame = resolveArrangeFrame({ shapes: [
      { outline: { type: 'circle' }, size: 1000, nails: 12, palette: ['#ff0000'], layers: 2, x: -2000 },
      { outline: { type: 'circle' }, size: 200, nails: 12, palette: ['#ff0000'], layers: 2, x: 2000, nailThickness: 0.4 },
    ] }, 1);
    expect(frame.nails.slice(0, 12).every((n) => n.w === undefined)).toBe(true);
    expect(frame.nails.slice(12).every((n) => n.w === 0.4)).toBe(true);
  });
});

describe('flyFraming', () => {
  const onWall = (path, extra = {}) => ({ mount: 'wall', shapes: [], camera: { fly: { path, bank: 0, ...extra } } });

  it('passes a dive that flies across or up a wall-hung piece, because the board stays below and the room the right way up', () => {
    expect(flyFraming(onWall([{ t: 0, x: -0.5, y: 0.5, h: 0.1 }, { t: 1, x: 0.5, y: 0.5, h: 0.1 }]))).toEqual([]);
    expect(flyFraming(onWall([{ t: 0, x: 0, y: 0.5, h: 0.4 }, { t: 1, x: 0, y: -0.5, h: 0.05 }]))).toEqual([]);
  });

  it('flags a dive down the wall while looking into it, which shows the room upside down', () => {
    const problems = flyFraming(onWall([{ t: 0, x: 0, y: -0.5, h: 0.6 }, { t: 1, x: 0, y: 0.5, h: 0.05 }]));
    expect(problems.some((p) => p.what === 'upside-down')).toBe(true);
  });

  it('flags the picture spinning about the line of sight, as when a pass across the wall swings round to look face-on at it', () => {
    const leg = (path, look) => {
      const recipe = onWall(path, { look: { ...look, h: 0 } });
      recipe.durationSeconds = 10;
      return recipe;
    };
    // Across the wall low, then rising to look face-on at it: the picture has to turn a quarter round.
    const swing = leg([{ t: 0, x: -0.6, y: 0, h: 0.6 }, { t: 0.5, x: 0.5, y: 0, h: 0.6 }, { t: 0.7, x: 1, y: 0, h: 3 }, { t: 1, x: 1, y: 0, h: 3 }], { x: 1.1, y: 0 });
    expect(flyFraming(swing).some((p) => p.what === 'rolling')).toBe(true);
    // The same rise heading up the wall: the board's up and the room's agree, so nothing turns.
    const climb = leg([{ t: 0, x: 0, y: 0.6, h: 0.6 }, { t: 0.5, x: 0, y: -0.5, h: 0.6 }, { t: 0.7, x: 0, y: -1, h: 3 }, { t: 1, x: 0, y: -1, h: 3 }], { x: 0, y: -1.1 });
    expect(flyFraming(climb)).toEqual([]);
  });

  it('flags the view whipping round when the drone flies right over its own look point', () => {
    const over = onWall([{ t: 0, x: 0, y: 0.6, h: 0.15 }, { t: 1, x: 0, y: -0.6, h: 0.15 }], { look: { x: 0, y: 0, h: 0.1 } });
    over.durationSeconds = 10;
    expect(flyFraming(over).some((p) => p.what === 'whip')).toBe(true);
    const far = onWall([{ t: 0, x: 0, y: 0.6, h: 0.15 }, { t: 1, x: 0, y: -0.6, h: 0.15 }], { look: { x: 0, y: -3, h: 0.1 } });
    far.durationSeconds = 10;
    expect(flyFraming(far).filter((p) => p.what === 'whip')).toEqual([]);
  });

  it('flags a picture tipped sideways by roll', () => {
    const problems = flyFraming(onWall([{ t: 0, x: -0.5, y: 0, h: 0.1 }, { t: 1, x: 0.5, y: 0, h: 0.1 }], {}), {});
    expect(problems).toEqual([]);
    const rolled = { ...onWall([{ t: 0, x: -0.5, y: 0, h: 0.1 }, { t: 1, x: 0.5, y: 0, h: 0.1 }]) };
    rolled.camera.roll = 20;
    expect(flyFraming(rolled).every((p) => p.what === 'tilted' || p.what === 'rolling')).toBe(true);
    expect(flyFraming(rolled).length).toBeGreaterThan(0);
  });
});

describe('flyFraming with cuts and transitions', () => {
  const flyShot = (from, path, extra = {}) => ({ from, fly: { path, bank: 0, ...extra } });

  it('does not take the jump at a cut between two drone shots for a whip', () => {
    const recipe = {
      mount: 'wall', shapes: [], durationSeconds: 10,
      camera: {
        shots: [
          flyShot(0, [{ t: 0, x: -0.5, y: 0.5, h: 0.1 }, { t: 0.5, x: 0.5, y: 0.5, h: 0.1 }]),
          flyShot(0.5, [{ t: 0.5, x: 0.5, y: 0.5, h: 0.1 }, { t: 1, x: 0.5, y: -0.5, h: 0.1 }]),
        ],
      },
    };
    expect(flyFraming(recipe)).toEqual([]);
  });

  it('still checks each drone shot on its own', () => {
    const recipe = {
      mount: 'wall', shapes: [], durationSeconds: 10,
      camera: { shots: [{ from: 0, azimuth: 90, elevation: 10 }, flyShot(0.5, [{ t: 0.5, x: 0, y: -0.5, h: 0.6 }, { t: 1, x: 0, y: 0.5, h: 0.05 }])] },
    };
    expect(flyFraming(recipe).some((p) => p.what === 'upside-down' && p.t >= 0.5)).toBe(true);
    expect(flyFraming(recipe).some((p) => p.t < 0.5)).toBe(false);
  });

  it('lets a fast turn through inside a moving transition, where it is meant', () => {
    const over = { mount: 'wall', shapes: [], durationSeconds: 10, camera: { fly: { path: [{ t: 0, x: 0, y: 0.6, h: 0.15 }, { t: 1, x: 0, y: -0.6, h: 0.15 }], look: { x: 0, y: 0, h: 0.1 }, bank: 0 } } };
    const whips = flyFraming(over).filter((p) => p.what === 'whip');
    expect(whips.length).toBeGreaterThan(0);
    const middle = (whips[0].t + whips[whips.length - 1].t) / 2;
    const seconds = (whips[whips.length - 1].t - whips[0].t) * 10 + 0.5;
    const blurred = { ...over, transitions: [{ type: 'blur', t: middle, seconds }] };
    expect(flyFraming(blurred).filter((p) => p.what === 'whip')).toEqual([]);
  });
});

describe('flyCrashes with cuts', () => {
  it('follows whichever drone shot is on screen', () => {
    const shapes = [{ outline: { type: 'circle' }, size: 1000, nails: 24, palette: ['#ffffff'], layers: 2 }];
    const recipe = {
      board: { size: 8000 }, shapes,
      camera: {
        shots: [
          { from: 0, fly: { path: [{ t: 0, x: 0, y: -1.5, h: 0.5 }, { t: 1, x: 0, y: -1.5, h: 0.5 }] } },
          // The second shot sits right on the rim of the circle, where its nails stand.
          { from: 0.5, fly: { path: [{ t: 0, x: 0, y: -0.25, h: 0.001 }, { t: 1, x: 0, y: -0.25, h: 0.001 }] } },
        ],
      },
    };
    const crashes = flyCrashes(recipe, { samples: 20 });
    expect(crashes.length).toBeGreaterThan(0);
    expect(crashes.every((c) => c.t >= 0.5)).toBe(true);
  });
});
