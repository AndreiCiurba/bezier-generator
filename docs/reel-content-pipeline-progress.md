# Reel content pipeline epic — progress tracker

See [epic-reel-content-pipeline.md](epic-reel-content-pipeline.md) for the design and the reasons
behind each decision.

## In-app (`/cardioid` reel hook)

- [x] `core/cardioidWeave.js` - `circlePointAt` (fractional nail index), `chordDrawAmount`
      (build-up reveal, sequential/parallel, with the string in progress part-drawn) and
      `nailSeating` (nails hammered in one by one) + tests.
- [x] `core/keyframe.js` - `easeInCubic` / `easeOutCubic` / `easeInOutCubic` + tests.
- [x] `cardioid/cardioidReelFrame.js` - pure recipe-at-time-t resolver (weave tracks, color
      tracks, layer gradient, spherical camera in circle radii) + tests.
- [x] `cardioid/CardioidSceneSync.js` - optional reel-only settings (`drawProgress`, `drawMode`,
      `nailProgress`, `layerColors`, `boardVisible`, `boardColor`, fractional multiplier/leap).
- [x] `cardioid/reelProps.js` - making-of props: bare/painted board with a moving paint edge,
      spray can, hammer. Driven by a recipe's `making` section; `hammerRaise` (pure) + tests in
      `cardioidReelFrame.js`.
- [x] Camera `tilt`, per-keyframe easing and the `easeOutExpo` / `easeInOutExpo` whip easings,
      for camera work with distinct beats.
- [x] `explain` - one string picked out bold, for reels that explain the rule.
- [ ] A hand in the making-of. A primitive-built one was tried and removed (it looked bad); a
      believable one needs a modelled asset or filmed footage composited in the edit.
- [x] `cardioid/CardioidReel.js` - `load` / `seek` / frame readback, optional bloom, string width
      scaled to frame size.
- [x] `cardioid/CardioidApp.js` - `?reel=1` gate.
- [ ] `/arrange` reel hook.
- [ ] `/3d` sample recipes re-derived against the current page.

## Pipeline (`tools/reel-pipeline/`)

- [x] `lib/capture.mjs` - GPU headless capture for any scene, JPEG pipe into ffmpeg, stills.
- [x] `lib/edit.mjs` - captions (HTML to transparent PNG overlays), soundtrack mux, fades, bitrate cap.
- [x] `lib/audio.mjs` - synthesized plucked-string track that follows the build-up, plus hammer
      knocks and spray hiss for making-of reels.
- [x] `lib/ideas.mjs` - ten archetypes (weave-reveal, times-table, flat-to-3d, tower-twist, dive,
      bloom, full-turn, hours, making-of, explainer), seeded variation, and a `choreograph`
      helper that builds each camera from distinct moves (push in, pull out, whip, flip under,
      overhead, lens punch, barrel roll).
- [x] `lib/colorhunt.mjs` + `palettes/colorhunt.json` - 72 Color Hunt palettes as the color
      source (`reels.mjs colorhunt` re-fetches).
- [x] `lib/feedback.mjs` - pick history and archetype weights.
- [x] `lib/gallery.mjs` - review page with picks, notes, copy-message and a full-screen viewer
      (arrow keys step through the batch, P picks).
- [x] `reels.mjs` - `ideas` / `sheets` / `batch` / `finish` / `render` / `taste` / `colorhunt` / `review`.
- [x] `lib/reviewServer.mjs` - review page on localhost with "Send to Claude", which runs the
      finishing prompt headlessly (Opus 5.5, medium) and reports back on the page. Checked with
      `--dry-run` (page, video seeking, path safety, send, status); not yet with a real run.
- [ ] Real music. Instagram/TikTok tracks cannot be put in the files (their licences cover use
      inside the apps only); `edit.audio.file` takes any track Andrei has the rights to.
- [ ] Unit tests for the pipeline's pure parts (`feedback.mjs` weights, `ideas.mjs` output shape,
      `audio.mjs` note math). The tools folder has no test runner of its own yet.
- [ ] User-supplied audio file path (`edit.audio.file`) - implemented, not exercised.

## Agents and scheduling

- [x] `STYLE.md` - style brief with a "Learned preferences" section.
- [x] `agents/daily-batch.md` - prompt for the scheduled batch run.
- [x] `agents/finish-picks.md` - prompt for finishing picks and recording taste.
- [x] `schedule/run-daily.ps1` + `schedule/register-daily-task.ps1` (Opus 5.5, medium effort).
- [x] `.claude/agents/reel-batch.md`, `.claude/agents/reel-finisher.md` - the same two jobs as
      subagents for use from an interactive session, pinned to Opus 5.5 at medium effort.
- [ ] First real scheduled run, end to end.
- [ ] Account handle filled into `STYLE.md`.

## Verified so far

- Six-reel example batch (`batches/example/`, one per archetype): sheets, previews with captions
  and sound, review page, and three finals at 1080x1920.
- Timing on this machine (Intel UHD, GPU path): ~12 s to capture a 10 s preview, 28-43 s for a
  full-size reel; six previews end to end in 1 min 44 s.
- First picks taken (2026-11-11): 01, 02 and 05 of `example`, with 05 reworked to be cleaner at
  Andrei's request; recorded in `feedback/history.jsonl` and `STYLE.md`.
- Second batch `batches/2026-11-11b/` (8 candidates) tries the ideas from that feedback:
  full-turn (layers = nails), hours, making-of, and the cleaner dive, all in Color Hunt palettes.
- Third batch `batches/2026-11-12/` (12 candidates, one or two of each idea) after Andrei's notes
  on the second: no hand, wider making-of with an unmissable thread start, the dive's full
  quarter-turn, the explainer, and choreographed cameras throughout. Reel 05 of `example`
  re-finished with the new dive.
- Not verified: the sound by ear, the scheduled run, and whether the `effort` line in the two
  agent definition files is honored (the scheduled run sets effort by command-line flag, which is).
