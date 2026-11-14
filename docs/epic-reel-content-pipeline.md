# Epic: Reel content pipeline

**Status:** first working version, built in one pass and exercised end to end on a six-reel example
batch (drafts, contact sheets, captioned previews with sound, review page, three full-size finals).
The scheduled agent run itself has not been run yet. See
[reel-content-pipeline-progress.md](reel-content-pipeline-progress.md) for the done/not-done list.

## Goal

A daily routine that produces short vertical videos of the app's string art for a social channel
with as little of Andrei's time as possible:

1. Every day (or every few hours) an agent generates about twenty candidate reels.
2. Andrei watches them on one page and picks the few worth posting, optionally with notes.
3. The picks are finished at full quality - camera moves, captions, sound - ready to upload.
4. What he picks feeds back, so the next batch is closer to his taste.

Posting stays manual. Neither Instagram nor TikTok is automated here, and the choice of what
represents the channel is the one step that should stay with a person.

## Shape of the solution

```
 scheduled agent (agents/daily-batch.md)                     Andrei              Claude (agents/finish-picks.md)
 ───────────────────────────────────────                     ──────              ───────────────────────────────
 read STYLE.md + pick history
 reels.mjs ideas   -> 20 draft recipes
 reels.mjs sheets  -> look at 5 frames of each
 rework / replace weak ones, write captions   (loop)
 reels.mjs batch   -> previews + index.html  ───────────►  open review page
 write NOTES.md (its own top five)                           tick picks, add notes
                                                             copy message  ──────►  apply notes to recipes
                                                                                     reels.mjs finish -> final/*.mp4 + post text
                                                                                     record picks, update STYLE.md
                                                             upload by hand  ◄──────  paths + captions
```

Everything a reel is lives in **one recipe JSON file**: the weave and how its numbers change, the
camera move, the look, the captions, the sound, the post text. Agents only ever write recipes and
run `tools/reel-pipeline/reels.mjs`; they never touch app or pipeline code.

## Decisions

### Start with the Cardioid board

`/cardioid` is fully described by a handful of numbers (nails, layers, leap, multiplier, height),
has no saved state to load, and every one of those numbers makes a good animation. That makes it
the ideal first scene for generated content: an agent can invent a new reel by writing numbers.
`/arrange` and `/3d` need designs to exist first (a shape library, saved patterns), so they come
after - see "Next" below.

### The same `?reel=1` hook as `/3d`, with the timeline math kept pure

`CardioidApp` gets the gate `ThreeApp` already has: with `?reel=1` it hides the menu, keeps the
drawing buffer readable, skips its animation loop and exposes `window.__reelTimeline`
(`cardioid/CardioidReel.js`) with the same `load` / `seek` surface as `three-page/ReelTimeline.js`.

All of "what does the board look like at time t" is `cardioid/cardioidReelFrame.js` - pure, no
Three.js, unit-tested - and `CardioidReel` only applies its result. `CardioidSceneSync#rebuild`
already rebuilt everything from a settings object on every change, so one frame is one more
rebuild; it gained a few optional, reel-only settings rather than a second code path:

- `drawProgress` / `drawMode` - how much of the weave is strung yet (`chordDrawAmount` in
  `core/cardioidWeave.js`), for the build-up reveal.
- Fractional `multiplier` and `leap` - chord ends are looked up with `circlePointAt`, which agrees
  with the nail list at whole indices. This is what makes the times-table morph and the twisting
  tower smooth.
- `layerColors` - one color per layer (a gradient up the stack) in place of the per-arc split.
- `boardVisible` / `boardColor`.

The normal page passes none of these and behaves exactly as before.

### Camera in spherical terms, measured in circle radii

A cardioid recipe's camera is `azimuth` / `elevation` / `distance` / `target` / `fov` / `roll`
rather than `/3d`'s radius-and-height: "tip over from straight down to 20 degrees" or "push in to
half the distance" is how a shot is described, and it is what an agent can reason about without
trial and error. Distances are in multiples of the circle radius so framing does not depend on
board size. Every field is a number or a keyframe track; per-pair easing and optional wobble come
from the existing `core/keyframe.js`.

### Render on the GPU

The original tools used SwiftShader (CPU) and took seconds per frame - a 16 s clip took half an
hour, which rules out twenty a day. Headless Chrome with `--use-angle=d3d11` renders on the
machine's own GPU: measured here on integrated Intel UHD graphics, about 60-85 ms per 1080x1920
frame. A ten-second preview captures in ~12 s and a full-size reel in 30-45 s; a twenty-reel batch
of previews is around six minutes. `--software` keeps the old path for machines without a GPU.

Frames leave the page as JPEG (`canvas.toDataURL`) and are piped straight into ffmpeg - no
per-frame files, and far less data across the DevTools connection than raw pixels.

String width in Three's `LineMaterial` is in screen pixels, so `CardioidReel` scales it to the
frame width. Without that a 540-wide preview shows strings twice as heavy as the final, and the
preview stops being a trustworthy miniature.

### Supersampled, and no sub-pixel strings

Fine-string recipes (weights around 0.06-0.1, 40+ layers) came out grainy: a string under a pixel
wide either hits a pixel or misses it, and the compressor turns that shimmer into noise. Two fixes,
both automatic: clips render at 2x (`SUPERSAMPLE` in `lib/capture.mjs`, via the page's
devicePixelRatio) and ffmpeg scales them down by area averaging; and `WovenFrameView` draws any
string thinner than a pixel one pixel wide with opacity equal to its coverage. Previews went to
720x1280 at lower compression. Capture costs about 1.7x the time.

### Capture and edit are separate steps

`lib/capture.mjs` produces a silent raw clip; `lib/edit.mjs` adds everything else. Changing a
caption or the sound re-runs only the edit (`finish --edit-only`, a few seconds).

- **Captions** are drawn by headless Chrome as transparent full-frame PNGs and overlaid by ffmpeg
  with a short fade and rise. HTML/CSS gives proper typography, accent-colored words and balanced
  line breaks for free, and sidesteps ffmpeg `drawtext`'s font and escaping problems on Windows.
  The named positions sit inside the band the apps leave clear of their own interface.
- **Sound** is synthesized (`lib/audio.mjs`): Karplus-Strong plucked strings over a soft pad, on a
  sixteenth-note grid. It reads the recipe's own `drawProgress` track, so plucks play while
  strings are going on, the melody climbs as the weave completes, and a low note lands when it
  finishes. No samples and no licensing questions. A recipe can instead point at a file in
  `audio/`. Trending sounds cannot be automated at all - they are attached in the app at posting.

### Preview small, finish only what is picked

The batch renders 540x960 previews with the full edit applied (what you judge is what you get,
captions and sound included) at a low bitrate. Only picked reels are rendered at 1080x1920. Before
either, `sheets` renders five still frames per recipe in a few seconds - that is how the agent
"sees" a recipe and iterates on it cheaply.

### The review page is a local HTML file

`batches/<date>/index.html`: a grid of the previews, a pick toggle and a note field on each, and a
button that copies a message ("Finish reels from batch ...: 03, 07" plus notes). Pasting that into
Claude Code is the hand-off; `CLAUDE.md` points such a message at `agents/finish-picks.md`. No
server, no accounts, works offline.

### Two kinds of memory

- `feedback/history.jsonl` - one line per candidate per batch, picked or not. `ideas` turns pick
  rates into archetype weights (smoothed, with a floor so nothing is dropped for good).
- `STYLE.md` - the written brief, with a "Learned preferences" section the finishing agent adds to
  from picks and notes. Numbers catch "build-ups get picked"; prose catches "the camera is too
  fast".

### Scheduling is local

The run needs the GPU, writes hundreds of megabytes of video, and its output is reviewed on this
machine, so it runs here: Windows Task Scheduler starts `schedule/run-daily.ps1`, which runs
`claude -p` with the batch prompt and a narrow tool allowance (file read/edit, and only
`reels.mjs` on the command line). A cloud-scheduled agent would have no GPU and nowhere convenient
to leave twenty videos.

## Known gaps

- **The scheduled run is untested.** `run-daily.ps1` parses and its flags exist in the installed
  CLI, but a real headless session has not been run through it. Run it once by hand first.
- **Sound has not been listened to by a person.** Levels are sane (about -18 dB mean, peaking just
  under 0 dB) and the notes are all drawn from one scale, but whether it is pleasant is a
  judgment only a listener can make.
- **The `/3d` sample recipes no longer render usefully** against the current `/3d` page (camera in
  among the nails, no strings) - with the original `render.js` as well, so this predates this
  work. The `/3d` page is reachable for content through `"scene": "grid"` instead (below).
- **`ideas` only drafts cardioid reels.** The arrange and grid scenes are written by hand (the
  batch agent is told they exist); `batches/2026-11-12-3d-shapes/` has six examples.

## Arrange and grid scenes

Added after the first week, to stop twenty cardioids a day looking alike:

- `"scene": "arrange"` (`/arrange?reel=1`, `arrange/arrangeReelFrame.js`): a composition of woven
  shapes - circle, oval, polygon, star, heart, petal, or raw anchors - each with its own nails,
  leap, layer colors, height and keyframed transform, and a `window` of the overall build-up in
  which it is strung. `repeat` makes radial rings (mandalas). Shapes are described inline rather
  than read from the user's saved library, so a recipe is self-contained.
- `"scene": "grid"` (`/3d?reel=1`, `three-page/gridReelFrame.js`): the `/3d` page's own lattice
  and per-cell weave, every cell woven, with build orders (center-out, sweep, spiral), nails
  rising, a height field (ripple, wave, dome) and Puppet-Warp pulls / a twist. `ReelTimeline`
  hands such a recipe to the new driver and hides the page's own scene, so old `/3d` recipes are
  untouched.

Both resolve a frame to the same plain data - nails `{x, y, h}` and woven segments with a height
at each end (`core/reelWeave.js`, built on the app's own `closedWeaveSegmentsForCurve`) - drawn by
one shared `three-page/WovenFrameView.js` through `three-page/WovenReel.js`. The orbit camera,
tracks and color helpers moved from `cardioidReelFrame.js` into `core/reelCamera.js`, and the
camera/bloom/pixel helpers from `CardioidReel.js` into `three-page/reelRender.js`, so all three
scenes share them.

### Light, wall and room

Added for the "on a wall in a room, day and night" reels. `core/reelLighting.js` (pure, tested)
resolves a recipe's `lighting` / `mount` / `room`; `WovenFrameView` applies it. Three.js does not
light `LineMaterial` strings, so each string's color is shaded on the CPU, hair-style
(Kajiya-Kay: bright where light crosses the thread, dark where it runs along it, plus a sheen).
The wall and floor are vertex-colored meshes shaded with the same function rather than Three's
own lights, so they never disagree with the strings, and shadows are the strings projected onto
the wall from each light in the wall's color without that light - cheap, exact for a flat wall,
and no shadow maps (fat lines cannot cast them). `mount: "wall"` turns the piece upright; layer
colors gain `"bands"` (solid tiers, e.g. 40 layers of a 4-color palette = 10 each).

## Next

1. `/arrange` as a scene: a recipe names shape presets and placements, the reel hook builds the
   board from them. This is where the variety is.
2. Bring `/3d` recipes back to life against the current page.
3. Richer edit: speed ramps, a beat-synced cut between two recipes, end cards.
4. Optional: publish the review page somewhere reachable from a phone.

## Buildable pieces and drone shots

Client feedback (2026-11-13): overlapping figures look good on screen but cannot be built,
because a string that runs into another figure's nail catches on it and bends the curve. They
also asked for drone-style shots that fly close over the board and under its structures.

- `nailClashes(recipe)` in `src/arrange/arrangeReelFrame.js` checks the finished piece:
  - a string of one figure passing within `NAIL_CLEARANCE` (the nail head's radius) of another
    figure's nail, below that nail's top;
  - two figures' nails standing in one spot.

  A figure strung above a shorter one on long nails is allowed, which is how nesting stays
  buildable. `resolveFigure` was split out of `resolveArrangeFrame` so the check sees each
  placed copy on its own.
- `camera.fly` (`resolveFlyCamera` in `src/core/reelCamera.js`) is a drone camera. It follows
  waypoints in board coordinates on a time-knotted Catmull-Rom curve, faces ahead or blends
  toward a board point, and banks into turns. `flyCrashes(recipe)` flags a path that goes through
  a nail or under the board.
- `reels.mjs check <batch>` prints both, and `sheets` and `batch` warn with the same lines.
