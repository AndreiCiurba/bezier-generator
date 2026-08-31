# Reel Pipeline

Turns the `/3d` string-art visualizer into raw vertical (1080×1920, 30fps)
MP4 clips for TikTok/Instagram Reels, using a scripted camera + palette
"recipe" instead of live screen recording. Raw clips only for now - no
captions/music/trend audio; drop the output into CapCut for that (see the
plan doc this was built from for why: CapCut has no automation API).

Two halves:
- **In-app** (`../../src/three-page/ReelTimeline.js`): a deterministic
  `seek(t)` driver wired into `/3d`, reachable only via `window.__reelTimeline`
  when the page is loaded with `?reel=1`.
- **Headless capture** (this folder): a Puppeteer + ffmpeg script that loads
  a recipe, calls `seek(t)` once per output frame, screenshots the canvas,
  and stitches the frames into an MP4.

## Setup

```
cd tools/reel-pipeline
npm install
```

Needs network access the first time you render - Three.js itself loads from
a CDN import map (see `../../3d/index.html`), it isn't bundled here.

## Before your first render: export a pattern

A recipe fills the whole grid via the app's existing "Auto" pattern-stamping
feature (see `ReelTimeline#load`), so there needs to be a real saved pattern
to stamp. Patterns aren't fabricated by this tool - build one the normal way
so its points are guaranteed to snap to real nails:

1. Open `/3d/index.html` in a regular browser.
2. In Drawing Mode, click a handful of nails to build a small shape, then
   hit "Reset" to commit it as a curve (or use an existing curve).
3. Open the **Patterns** panel, save your selection as a pattern.
4. Click **Export** - this downloads `patterns.json`.
5. Move that file to `tools/reel-pipeline/patterns/sample.json` (or point a
   recipe's `"pattern"` field at wherever you saved it, relative to the
   recipe file itself - e.g. a recipe in `recipes/` pointing at
   `patterns/` needs `"../patterns/your-file.json"`).

Two ready-to-use pattern files are already checked in, so every sample
recipe above works out of the box without doing the above first:
- `patterns/sample.json` - a small diamond.
- `patterns/variety.json` - four more shapes (diamond/zigzag/star/spiral),
  referenced by `patternId` from the samples that use them.

Both were generated from real grid nail positions rather than hand-picked
coordinates (see `gen-sample-pattern.mjs`/`gen-variety-patterns.mjs`) - the
same technique described above, just scripted.

## Rendering a clip

```
npm run render -- recipes/orbit-color-cycle.json
```

Output lands in `output/<recipe-name>-<timestamp>.mp4`. Add `--keep-frames`
to keep the intermediate PNGs (in `frames/`) for debugging instead of
deleting them after encoding.

Add `--raw` to use the raw-pixel-pipe capture mode instead of PNG-per-frame
(see below) - not yet benchmarked against the default mode, so treat it as
experimental until it's actually been used for a real render.

`recipes/quick-test.json` is a ~1.5s/45-frame version of the same recipe -
useful for a fast sanity check (does the pipeline still run end-to-end?)
without waiting for a full clip. Software-rendered headless WebGL is slow
per frame (expect roughly a few seconds/frame, so an 8s/240-frame clip can
take 15-20 minutes, and a 16s/480-frame one 30+ minutes - more with a
25-color palette's extra geometry) - the quick recipe is meant for
iterating on the pipeline itself, not for judging how a clip actually
looks. Use `preview-frame.mjs` (below) instead for judging a new recipe
cheaply.

## Sample recipes

- `orbit-color-cycle.json` - the original MVP: fixed-radius orbit, 2-layer
  color cycle, the diamond pattern.
- `pattern-zigzag-orbit.json` - the zigzag pattern shape, moderate orbit,
  light camera wobble.
- `pattern-spiral-zoom.json` - the spiral pattern, camera pushes in from far
  to close over the clip (a "zoom in" move, not a full fly-through).
- `nail-height-pulse.json` - nails grow/shrink twice over the clip while the
  camera holds a gentle orbit - the "spikes" reveal.
- `flythrough.json` - orbits outside, dives to the center of the board
  (radius/height both drop toward 0 mid-clip, so the camera ends up down
  among the nail bases looking across the strings from inside the weave),
  then climbs back out the other side as the orbit continues. 8-layer
  rainbow color cycle, camera wobble throughout.
- `flight-red.json` / `flight-green.json` / `flight-blue.json` /
  `flight-rainbow.json` - the "flight" family (see `gen-flight-recipes.mjs`):
  full 360 orbit, then a brief dive to the center (a smaller version of
  `flythrough.json`'s dive, with only a little angular creep during it -
  see `camera.angleKeyframes` below), then the camera reverses direction and
  sweeps the same 360 backwards. Star pattern, Auto-stamped across the whole
  grid, 25-color palette (`colorCount: 25`). The three shade variants give
  each of the 25 layers a different lightness of the same hue (dark to
  bright); `flight-rainbow.json` spreads a full red-to-violet gradient
  across the 25 layers instead. 16s each.
- `quick-test.json` - ~1.5s/45-frame version of `orbit-color-cycle.json`,
  for fast pipeline sanity checks (see above).

## Recipe format

See the sample recipes above for real examples. Fields:

- `durationSeconds` - clip length. Combined with the pipeline's fixed 30fps,
  determines total frame count.
- `pattern` - path (relative to the recipe file) to a patterns JSON file
  exported from the app's Patterns panel. Omit entirely to animate over
  whatever's already drawn instead of auto-filling the grid.
- `patternId` - which pattern in that file to use, if it has more than one.
  Defaults to the first.
- `strokeWeight` - locks the auto-stamped curves to this weight; `null`
  (or omitted) uses the color-count-derived default.
- `colorCount` - resizes the palette to this many slots before stamping
  (the app's own default is 8; the "flight" recipes use 25). Each `colors`
  track entry's `layer` index needs to be within this range to have any
  effect.
- `showInnerNails` - the slim weave-subdivision nails are hidden by default
  for every recipe (they read as clutter, not a feature, in a posted clip).
  Set `true` to opt back in.
- `camera` - orbits around the board, looking at its center. Fields:
  - `startAngle`/`endAngle` - degrees, linearly swept over the clip (the
    simple case). For a non-linear sweep (e.g. slow-fast-slow, or more than
    one revolution), use `angleKeyframes: [{ t, value }, ...]` instead -
    it overrides `startAngle`/`endAngle` entirely.
  - `radius`/`height` - either a plain constant number, **or** a
    `{ keyframes: [{ t, value }, ...], easing }` track - e.g. a radius that
    drops toward 0 mid-clip flies the camera through the center of the
    board and out the other side (see `flythrough.json`).
  - `wobble` - optional `{ radius, height, angleDegrees }`, each
    `{ amplitude, frequency, seed }`. Layers deterministic, non-repeating-
    looking jitter on top of the path (see `../../src/core/keyframe.js#wobble`)
    for a less mechanically smooth, more "handheld"/videogame-hazard feel.
    `frequency` is cycles over the whole clip, not Hz.
  - `easing` - applies to the angle sweep and any `radius`/`height` track
    that doesn't specify its own.
  - Omit `camera` entirely to leave the camera at its default pose.
- `colors` - array of `{ layer, keyframes: [{ t, color }, ...], easing }`.
  Each entry animates one palette slot's hex color over normalized clip
  time `t` (0 to 1). Layers not listed keep whatever color the palette
  already has.
- `nailHeight` - `{ keyframes: [{ t, value }, ...], easing }`, animates the
  global nail height (a "spikes grow" reveal - see `nail-height-pulse.json`).
- `deformation.pins` - array of `{ referencePosition: {x,y}, radius,
  falloff, keyframes: [{ t, x, y }, ...] }`, each animating one Puppet Warp
  pin's position over the clip (a ripple/warp effect).

`easing` is `"linear"` (default) or `"easeInOutQuad"` - see
`../../src/core/keyframe.js`.

## Capture mode: PNG-per-frame vs. `--raw`

Default capture screenshots the canvas to a PNG file every frame, then
ffmpeg reads the sequence back and encodes it - simple, and `--keep-frames`
makes the intermediate PNGs easy to inspect, but every frame pays for a PNG
encode in Chrome and a PNG decode in ffmpeg, plus disk I/O for hundreds of
files.

`--raw` instead reads raw RGBA pixels straight off the WebGL context
(`ReelTimeline#readPixelsBase64`) and pipes them directly into a single
persistent ffmpeg process's stdin as they're captured - no per-frame image
codec, no intermediate files on disk at all until the finished video. The
pixels are base64-encoded for the trip out of the page (see that method's
doc for why - a raw byte array serializes far slower through Puppeteer's
JSON-based `page.evaluate`), decoded back to bytes in Node, and written to
ffmpeg configured with `-f rawvideo -pixel_format rgba`.

```
node render.js recipes/quick-test.json --raw
```

This mode hasn't been benchmarked against the default yet - the theory
(skip a redundant PNG encode/decode round-trip per frame, skip disk I/O)
should make it faster, but "should" isn't "measured." Worth an A/B timing
comparison before relying on it for a real render. `--keep-frames` has no
effect in `--raw` mode - there's nothing intermediate to keep.

## Fast iteration: previewing a single frame

Capturing all 240+ frames of a full clip just to check whether a new
recipe's camera/color/pattern combo looks right is slow (see the risk note
below). `preview-frame.mjs` loads a recipe and screenshots exactly one
frame at a given normalized time instead:

```
node preview-frame.mjs recipes/flythrough.json 0.5 preview.png
```

The `t` argument (default 0.5) is the same normalized clip time `seek()`
takes - `0.5` on `flythrough.json` lands mid-dive, `0.1` shows the wide
outside-orbit establishing shot, etc.

## Known risk: headless WebGL

Headless Chrome's WebGL support depends on the launch flags in `render.js`
(`--enable-unsafe-swiftshader` etc.) and can vary by Chrome version/OS. If a
render produces all-black or frozen frames, that's the first thing to
revisit - try `--keep-frames` and open a captured PNG directly to confirm
whether the scene rendered at all before touching anything else.
