# Reel Pipeline

Turns the app's 3D string-art pages into vertical (1080×1920, 30fps) reels
for TikTok/Instagram from a scripted "recipe" instead of live screen
recording.

There are two generations of tooling in this folder:

- **The content pipeline (`reels.mjs`)** - the current one. Drafts a batch of
  candidate reels, renders them on the GPU with captions and a synthesized
  soundtrack, builds a review page to pick from, and finishes the picks at
  full size. Meant to be run daily by an agent. Starts at "Content pipeline"
  below; the design is in `../../docs/epic-reel-content-pipeline.md`.
- **The original single-recipe tools (`render.js`, `preview-frame.mjs`)** for
  the `/3d` grid page - raw silent clips, software rendering. Documented from
  "Before your first render" onward, and kept as they were.

Both drive the same in-app hook: a page opened with `?reel=1` exposes
`window.__reelTimeline` with a deterministic `load(recipe)` / `seek(t)`
(`../../src/three-page/ReelTimeline.js` for `/3d`,
`../../src/cardioid/CardioidReel.js` for `/cardioid`), and headless Chrome
calls `seek(t)` once per output frame.

## Setup

```
cd tools/reel-pipeline
npm install
```

Needs network access the first time you render - Three.js itself loads from
a CDN import map (see `../../3d/index.html`), it isn't bundled here.

## Content pipeline

```
node reels.mjs ideas  2026-11-11 --count 20     # draft recipes -> batches/2026-11-11/recipes/
node reels.mjs check  2026-11-11                # could each piece be built with real nails? (arrange scene)
node reels.mjs sheets 2026-11-11                # 5 frames of each, side by side -> sheets/<id>.jpg
node reels.mjs batch  2026-11-11                # preview clips + review page -> index.html
node reels.mjs finish 2026-11-11 03 07          # the picks at 1080x1920 -> final/
node reels.mjs taste                            # pick rates so far
node reels.mjs colorhunt                        # re-fetch the Color Hunt palettes drafts are colored from
```

`reels.mjs` works from any directory. A **batch** is a folder under `batches/`
(ignored by git) that candidates move through:

| Folder | What is in it |
| --- | --- |
| `recipes/NN-<archetype>-<palette>.json` | One file per reel. `NN` is its id everywhere else. |
| `sheets/NN.jpg` | Start / quarter / half / three-quarter / end frames (or `--times 0.1,0.3,...`), no captions. For judging a recipe in seconds. |
| `previews/NN.mp4` | 720x1280 (rendered at 2x and scaled down) with captions and sound. What the review page plays. |
| `index.html` | The review page: tick the ones to post, add notes, copy the message for Claude. "Full screen" on a clip (or a double-click) opens it filling the window; arrow keys step through the batch, P picks. |
| `final/<name>.mp4` + `.txt` | Full-size reel and its post caption + hashtags. |
| `raw/`, `work/` | Silent full-size captures and scratch files. Safe to delete. |

Rendering is on the GPU by default (ANGLE/D3D11): about 12 s to capture a 10 s
preview and 30-45 s for a full-size clip on integrated Intel graphics. Add
`--software` to fall back to the CPU renderer, which is many times slower.

### The daily loop

1. **`agents/daily-batch.md`** is the prompt for the scheduled agent. It reads
   `STYLE.md`, drafts twenty recipes, looks at their sheets, reworks or
   replaces the weak ones, writes captions and post text, renders the
   previews and leaves `NOTES.md` with its own top five.
   `schedule/run-daily.ps1` runs it headlessly on Opus 5.5 at medium effort
   (`-Model` / `-Effort` change that); `schedule/register-daily-task.ps1` puts
   it on Windows Task Scheduler.
2. When the batch is ready, the scheduled run starts `reels.mjs review <date>`,
   which serves the review page at http://localhost:5520/ and opens it. You
   pick, add notes, and press **Send to Claude**: that starts the finishing
   agent headlessly (no chat needed), and the page shows its progress, its
   reply and links to the finished reels. The server stops by itself after
   20 idle hours; `reels.mjs review <date>` starts it again for any batch.
   (Opened straight from disk, the page can only copy the message for you to
   paste into Claude Code.)
3. **`agents/finish-picks.md`** tells Claude what to do with that message:
   apply your notes, run `finish`, and write what it learned from your picks
   into `STYLE.md`. In this repository it runs as the `reel-finisher`
   subagent (`.claude/agents/`), also Opus 5.5 at medium effort.

`finish` also appends the batch's picked/passed result to
`feedback/history.jsonl`; `ideas` reads that to bring picked archetypes up
more often (never dropping any to zero).

### Recipe format (cardioid scene)

`"scene": "cardioid"` renders the Cardioid board (`/cardioid`): one circle of
nails, nail `j` joined to nail `multiplier * j`, stacked into layers that are
each turned `leap` nails from the one below. `lib/ideas.mjs` has ten complete
examples (`ideas --archetypes hours,making-of` drafts only the named ones).

Draft colors come from `palettes/colorhunt.json`: the most-liked palettes
under a dozen Color Hunt tags, minus colors too dark to show as thread, saved
in git so a batch never depends on the site being up.

Anywhere a number is expected below, a **track** can be given instead:
`{ "keyframes": [{ "t": 0, "value": 2 }, { "t": 1, "value": 5 }], "easing": "easeInOutCubic" }`.
`t` is normalized clip time (0 = first frame, 1 = last). Before the first
keyframe and after the last, the value holds. `easing` applies between each
pair of keyframes: `linear` (default), `easeInOutQuad`, `easeInCubic`,
`easeOutCubic`, `easeInOutCubic`, and the snappy `easeOutExpo` /
`easeInOutExpo`. A keyframe may carry its own `"easing"`, which shapes the
move arriving at it and overrides the track's - so one track can drift, snap
and drift again. A track may also carry
`"wobble": { "amplitude", "frequency", "seed" }` for slow handheld drift
(`frequency` is cycles per clip), and `{ "value": 30, "wobble": {...} }` is a
constant with drift.

- `durationSeconds`
- `meta`: `{ id, archetype, palette, title }` - labels for the review page and
  for pick-rate tracking. No effect on the picture.
- `weave`:
  - `nailCount` (whole number), `layerCount` (whole number, 1-60)
  - `multiplier` - 2 is the cardioid, 3 the nephroid. Fractional values are
    fine mid-animation: that is the smooth times-table morph.
  - `leap` - how many nails each layer is turned from the one below. May be
    fractional and animated: the stack twists.
  - `radius` (default 3000; rarely worth changing, since the camera is
    measured in radii) and `height` (how tall the stack is, in the same units)
  - `weight` - string thickness as seen in the full-size reel (0.3 fine, 0.7 bold)
  - `nailsVisible` (true/false), `nailThickness` (0 = strings meet at a point;
    ~16 shows the thread splitting round a real nail), `showWrap`
  - `drawProgress` - 0..1, how much of the weave is strung yet. Animate it
    for a build-up; the string in progress is shown travelling from its
    first nail to its second. `drawMode`: `"sequential"` (one thread, layer
    after layer) or `"parallel"` (every layer at once).
- `colors`: list of hex colors; each may instead be
  `{ "keyframes": [{ "t": 0, "color": "#ff0000" }, ...] }` to change over the clip.
- `colorMode`: `"layer"` (a gradient through the colors up the stack) or
  `"arc"` (each layer split into one arc of the circle per color).
- `look`: `background` (hex), `board` (`false` to hide it, or a hex color),
  `nailColor`, `bloom` (`{ strength, radius, threshold }` - keep strength at
  0.1-0.2; dense pieces blow out to white above that).
- `making` (optional) - the making-of stages, each a number or track 0..1.
  With this section present, `look.board` is the bare board's color and the
  reel adds the props (`src/cardioid/reelProps.js`):
  - `paint` - how much of the board has been sprayed `paintColor`; a spray
    can (`canColor`) works along the wet edge while it is between 0 and 1.
  - `nails` - how many of the nails are hammered in, going round from nail 0
    (the top of the circle, camera azimuth -90). A hammer drives the current
    one, three blows a nail.
  The soundtrack adds a knock per hammer blow and a hiss while spraying.
- `explain` (optional) - `{ chord, color, weight }` redraws one string of the
  bottom layer bold in its own color: the one from nail `chord` to nail
  `multiplier * chord`. `chord` is a number or track (0 = off), so stepping
  it 1, 2, 3 walks through the rule a string at a time.
- `camera` - every field a number or a track:
  - `azimuth` - degrees round the board. A track from 0 to 360 is one full orbit.
  - `elevation` - degrees above the board: 90 straight down, 0 side-on,
    negative looks up from underneath (hide the board for that).
  - `distance` - in circle radii. About 4.6 fits the whole circle across the
    frame; 3 is a close-up that crops the sides; below 1 is inside the piece.
  - `targetX` / `targetY` / `targetZ` - the point looked at, in circle radii,
    `Y` up. Raise `targetY` to about half of `height / radius` to center a tall
    stack; animate X/Z to pan.
  - `fov` (default 50; widen to ~70 for fly-throughs, narrow to ~28 for a
    lens punch-in), `roll` (degrees; 360 is a barrel roll).
  - `tilt` - degrees the view is pitched up from where it would otherwise
    look, without moving the camera.
  - When `distance` is near 0 the camera is at its own target, and changing
    `elevation` / `azimuth` turns it on the spot instead of moving it.
- `edit` - the finishing pass (`lib/edit.mjs`):
  - `captions`: `[{ text, start, end, position, size, style, color, accent }]`.
    `start`/`end` are **seconds**. `*stars*` put words in the accent color and
    a newline breaks a line. `position`: `"top"`, `"center"`, `"bottom"`, or a
    number 0..1 down the frame (top and bottom sit inside the area the apps
    leave clear). `size`: `xl`, `l`, `m`, `s`. `style`: `plain` or `pill`.
  - `handle`: account tag held at the foot of the frame.
  - `audio`: `{ "synth": { scale, rootMidi, bpm, brightness, pad, seed } }`
    for the built-in plucked-string track (scales: `pentatonic`,
    `minorPentatonic`, `lydian`, `dorian`, `hirajoshi`); or
    `{ "file": "name.mp3", "start": 0, "volume": 1 }` for a track of your own
    in `audio/`. Left out (or `false`), the clip is silent. With a `drawProgress` build-up the
    synth plucks while strings are going on and lands a low note when the
    weave completes.
  - `fadeIn` / `fadeOut`: seconds, default 0.
- `post`: `{ caption, hashtags: [] }` - written next to the final as a `.txt`.

`"scene": "3d"` (or no `scene`) renders the original `/3d` grid page with the
recipe format described under "Recipe format" below; the `edit` and `post`
sections work the same for every scene.

### Recipe format (arrange scene)

`"scene": "arrange"` composes woven shapes on the Arrange board - the Shapes
page's outlines and its leap weave, described inline (no saved library
needed). Full reference: the doc comment of `src/arrange/arrangeReelFrame.js`.
In short:

- `weave`: `drawProgress` (0..1 track - the whole piece's build-up, which the
  sound follows), `weight`, `nailsVisible`, `drawMode`, `layerSpacing`
  (world units between layers; when set, every figure starts at the board
  and is as tall as its layer count - use it on every recipe).
- `shapes`: each has an `outline` (`circle`, `oval` + `ratio`, `rect` + `ratio`, `polygon` +
  `sides`, `star` + `points`/`inner`, `heart`, `petal` + `width`, or raw
  `anchors`), `size` (world units), `nails`, `leap`, `colors` or
  `palette` + `layers` (+ `colorMode: "bands"` for solid tiers - 40 layers of a
  4-color palette are 10 of each), and `x`/`y`/`rotation`/`scale`/`height`/`base` (numbers
  or tracks). `window: [start, end]` is the slice of `drawProgress` in which
  that shape is strung (its nails rise first). `repeat: { count, radius,
  phase, stagger, spin }` makes a ring of copies turned to face outward, each
  strung a little after the last. Per shape, `weight` multiplies
  `weave.weight` (e.g. 0.5 for a soft fill), and `border: { weight, layers,
  color }` adds thicker strings round the outline - by default at the top
  layer of every color band, 2.5x as heavy - so edges read crisply over a
  fine fill. Borders are strung along with their layer.
- Irregular figures: outline `blob` (`lobes`, `wobble`, `seed`, `ratio`) is an
  organic lumpy shape. A `repeat` can vary its copies: `grow` (each one scaled
  up), `radiusStep` (a spiral), `layersStep` (each one taller), `turnStep`,
  `arc` (part of the circle, ends included) and `jitter: { angle, radius,
  scale, turn, layers }` with `seed`.
- `board: { size, color }` or `false`; `unit` (world units per camera
  distance unit - set it to the composition's radius so `distance` 3.5-4
  frames the whole piece); `camera` as in the cardioid scene.
- `look`: `background`, `nailColor`, `nailThickness`, `bloom`.

**It has to be buildable.** A nail is a real rod. A string that runs through
another figure's nail (below that nail's top) catches on it and bends its
curve. `node reels.mjs check <batch>` lists every recipe where that happens,
or where two figures' nails stand in one spot; `sheets` and `batch` print the
same warnings. Figures that sit side by side with a gap between them are
fine. A figure starting above the board (`base`) is flagged too: every
structure starts at board level. The check looks at the finished piece, the first moment the
whole weave is on; Rubik's-style turns after that are a flourish.

**Drone shots (`camera.fly`).** Instead of orbiting, the camera can fly a
path like a drone, low between the nails and under raised strings:

```json
"camera": {
  "fov": 62,
  "fly": {
    "path": [
      { "t": 0,    "x": 0.15, "y": 2.3,  "h": 1.1 },
      { "t": 0.28, "x": 0.02, "y": 1.05, "h": 0.08 },
      { "t": 0.5,  "x": 0,    "y": 0,    "h": 0.1 },
      { "t": 1,    "x": -0.4, "y": -2.2, "h": 1.5 }
    ],
    "look": { "x": 0, "y": 0, "h": 0.1,
      "blend": { "keyframes": [ { "t": 0, "value": 1 }, { "t": 0.22, "value": 0 }, { "t": 0.72, "value": 0 }, { "t": 0.9, "value": 1 } ] } },
    "bank": 0.4
  }
}
```

- `path` waypoints are in **board coordinates**, multiples of `unit`: `x`,
  `y` across the board (as the shapes' `x`/`y`), `h` up off it. The camera
  glides through them on a smooth curve that stays smooth across uneven
  timing. On a wall-hung piece the same waypoints follow the mount.
- `look`: `"ahead"` (the default) faces the way it flies. `{ x, y, h, blend }`
  faces a board point instead, and `blend` (0..1, a track) eases between the
  two: open on the piece (1), turn ahead to dive and fly (0), turn back to the
  piece for the last frame (1). Looking ahead just after flying through
  something shows empty dark, so blend back before that.
- `bank` leans into turns (0 = level). `fov`, `tilt` and `roll` work as usual.
- Fly *inside* the strings: every figure starts at the board, so the way in
  is down an open center (a high leap keeps the chords near the rim) or
  between nails where they are sparse (spacing well over 120 units), then
  through the layers. Raising a figure on long nails (`base`) to fly under
  it is not allowed: `check` flags it. Up
  close a thread is still about a pixel wide, so under-shots need more
  layers and heavier strings than the overhead look (about `weave.weight`
  0.2 with fill `weight` 1). Slim nails (`look.nailThickness` about 0.45)
  keep the passing rods from filling the frame.
- `check` also flags the moments a fly path goes through a nail or under the
  board.

### Recipe format (grid scene)

`"scene": "grid"` renders the `/3d` page's nail lattice with every cell
woven, plus things a real board cannot do. Full reference: the doc comment of
`src/three-page/gridReelFrame.js`. In short:

- `grid`: `{ size, shape: "triangle"|"square"|"hexagon", spacing }`.
- `weave`: `inner` (nails per cell edge), `leap`, `layers`, `palette`,
  `colorMode` (`layers`, `bands`, `radial`, `angle`, `random`), `weight`, and the
  build-up tracks `drawProgress` (cells strung in `order`: `center`, `sweep`
  at `sweepAngle`, `spiral`, `random`; `softness` overlaps them) and
  `nailProgress` (nails rising out of the board from the center).
- `height`: `{ shape: "flat"|"ripple"|"wave"|"dome", base, amplitude,
  wavelength, phase }` - the string surface's height across the board;
  animate `phase` (cycles) to make a ripple travel.
- `warp: [{ x, y, radius, dx, dy }]` pulls and `twist: { angle, radius }`
  wrings the lattice (lengths in grid spacings, `dx`/`dy`/`angle` may be tracks).
- `variety: { fill, leap, layers, height, seed }` makes the cells differ
  instead of repeating one tile: `fill` (0..1) is the share of cells woven at
  all (unused nails stay in the board), `leap`/`layers` how far each cell's
  leap may rise and layer count fall (whole numbers), `height` (0..1) how much
  lower a cell's stack may sit. Fixed per `seed`.
- `board: { color, padding }` or `false`; the camera's distance unit is half
  the lattice's width.

`batches/2026-11-12-3d-shapes/recipes/` holds three worked examples of each.

### Lighting, wall and room (arrange and grid scenes)

Without these fields the strings are drawn unlit (flat colors), as before.
Full reference: the doc comment of `src/core/reelLighting.js`.

- `lighting`: `{ background, ambient: { color, intensity }, lights: [...] }`.
  `background` is a color or color track (day/night). Each light is
  `"type": "point"` - placed exactly like the orbit camera (`azimuth`,
  `elevation`, `distance`, `targetX/Y/Z`, in units), so an orbiting light is an
  `azimuth` track - or `"type": "directional"` (`azimuth`, `elevation`: where
  sunlight comes from). Plus `color`, `intensity` (1 = full white; a step in
  the track is a switch), `sheen` (0..1, the glint along a thread),
  `reach` (point only, units - the light halves at this distance, which
  gives a lamp a pool of light), `shadow` (default on in a room).
  Strings are lit like thread: bright where the light falls across them, dark
  where it runs along them, so a moving light makes the weave shimmer.
- `mount`: `"board"` (lying flat, default) or `"wall"` (hung upright on a wall
  facing +z: the design's top is up, string height comes out toward the
  viewer; camera `azimuth` 90 / `elevation` 0 faces it head-on, `elevation`
  goes up/down the wall).
- `room`: `{ wall, floor, width, height, floorAt }` - a wall behind the piece
  and a floor in front (colors may be tracks; sizes in units, `floor: false`
  for none). A room hangs the piece on the wall by default and every light
  casts the strings' shadows on it. `room.lamps: [{ x, z, intensity, color,
  reach, table, tableHeight, height }]` stands table lamps in the room (`x`
  along the wall, `z` out from it, in units): each is drawn (side table,
  stem, shade) and is also a point light at its bulb - its shade glows as its
  `intensity` rises, so a step in that track is the switch. A lamp at `x` 1.9,
  `z` 0.9 sits beside a piece of radius ~1; frame it with `targetX` ~1,
  `targetY` ~-0.6, `distance` ~5.5. Wall, floor, strings and shadows all use
  the same light math, so they always agree.
- Keep `bloom` off in a lit room - it makes a bright wall glow.
- **Making-of** (board painted, nails hammered, strung, hung on the wall):
  `board.color` may be a color track (raw wood to paint); `weave.nailMode:
  "hammer"` sets nails one after another round each outline, each driven in,
  over `weave.nailShare` of each shape's window (default 0.15 - give it 0.3-0.4
  to watch the hammering) - use `weave.nailsVisible: true` for this one;
  `mount` as a track from 0 (flat on the bench) to 1 (on the wall) turns the
  piece up; `room.brightness` (0..1 track) keeps the room black during the
  bench part and brings it up once the piece is hung. Clips are silent
  unless `edit.audio` asks for sound.

### Known issue: the sample `/3d` recipes are out of date

The sample recipes in `recipes/` were written against an earlier `/3d` page.
Rendered today (with `render.js` or `reels.mjs`, same result) the camera ends
up in among the nails and no strings appear. The cause has not been tracked
down; the likely one is that the page's scale has changed since, so
`camera.radius: 900` is no longer outside the board and the sample patterns
no longer land on nails. They need re-deriving against the current page
before `"scene": "3d"` is useful for content. The Cardioid scene is
unaffected.

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
