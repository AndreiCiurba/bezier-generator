# Daily reel batch

You are producing today's batch of candidate reels for a string-art channel. Andrei will open a
review page later, watch the candidates, and pick the few worth posting. Your job is to make that
choice hard: twenty candidates that are each a distinct, finished-looking idea, not twenty
variations of one.

You are running unattended. Nobody will answer questions, so make reasonable decisions, note them,
and keep going. The batch name is given at the end of this prompt (normally today's date).

## What you are working with

Everything runs through one tool, called from the repository root:

```
node tools/reel-pipeline/reels.mjs <command>
```

- `ideas <batch> --count 20` writes twenty draft recipes into
  `tools/reel-pipeline/batches/<batch>/recipes/`. They come from ten proven archetypes with random
  variation, colored from the saved Color Hunt palettes, and already weighted toward what has
  been picked before.
- `sheets <batch> [--only 03,07] [--times 0.1,0.3,0.5]` renders frames of each recipe side by
  side into `batches/<batch>/sheets/<id>.jpg` - start, quarter, half, three-quarter and end
  unless you give `--times` (normalized clip times; use it to look closely at one part of a long
  reel). A few seconds each. This is how you see your work: open the JPEGs with the Read tool.
- `batch <batch> [--only 03,07]` renders the small preview clips (captions and sound included)
  and writes the review page `batches/<batch>/index.html`. About fifteen seconds per clip.
- `check <batch> [--only 03,07]` checks that each arrange piece could be built with real nails:
  no string through another figure's nail, no two figures' nails in one spot, no fly camera
  through a nail. Every recipe must come out "ok" before `batch` (see STYLE.md and README
  "It has to be buildable").
- `taste` prints pick rates so far by archetype and palette.

A recipe is one JSON file describing one reel: the weave, how its numbers change over the clip,
the camera move, the look, the captions, the sound and the post text. The format is documented in
`tools/reel-pipeline/README.md` under "Recipe format (cardioid scene)". Read that section before
editing recipes; `tools/reel-pipeline/lib/ideas.mjs` shows ten complete worked examples.

Two more scenes exist that `ideas` does not draft: `"scene": "arrange"` (woven shapes - petals,
hearts, stars, polygons - composed on a board) and `"scene": "grid"` (the `/3d` nail lattice with
every cell woven, rippled, twisted or domed). Their formats are in the same README, and
`tools/reel-pipeline/batches/2026-11-12-3d-shapes/recipes/` has six worked examples. When the
batch is starting to look alike, replace a few drafts with recipes of your own in these scenes.
Both can also be lit, hung on a wall and placed in a room with day/night light ("Lighting, wall
and room" in the README).

## Before you start

1. Read `tools/reel-pipeline/STYLE.md` in full. It is the brief, and its last section records
   what Andrei has liked and disliked so far. Where it conflicts with anything here, it wins.
2. Run `taste`.
3. Skim the recipe file names of the two most recent folders in `tools/reel-pipeline/batches/`
   and any `NOTES.md` in them, so today does not repeat yesterday.

## The work

1. **Draft.** Run `ideas` for today's batch, then `sheets` for all of it.

2. **Look at every sheet and judge it honestly.** For each one, ask:
   - Is the first frame already interesting, or is it empty or black?
   - Does the piece fill the frame at its best moment without being cut off by the edge?
   - Can you still see individual strings somewhere, or has it become a solid blob?
   - Do the frames differ enough that there is clearly a move or a change happening? Is the
     camera doing at least three clearly different things over the clip (see "Camera" in
     STYLE.md), or is it one slow orbit?
   - At the moment the reel's idea happens - the first string going on, the number changing, the
     turn inside the piece - is the frame wide enough and the subject bold enough to see it? Check
     that exact moment with `--times`, not just the five default frames.
   - Would you stop scrolling for it?

3. **Rework the batch until it is good.** The drafts are a starting point, and several will be
   weak. Edit recipe files directly:
   - Fix what the sheets showed: camera distance and elevation for framing, fewer layers or a
     lighter `weight` for blobs, different timing for a dull first frame.
   - **Replace at least six drafts with ideas of your own** that are not just an archetype with
     new numbers. Combine things that have not been combined: a build-up seen from inside, a
     times-table morph on a tall stack, a multiplier that sweeps while the camera tips over, nail
     count growing from a triangle to a full circle, two parameters trading off, a color change
     timed to a camera move. Anything the recipe format can express is fair game. Give each a
     short archetype name of its own in `meta.archetype` so its pick rate can be tracked.
   - Keep the batch varied: no palette on more than three reels, no more than four reels of any
     one archetype, a spread of durations (most between 7 and 13 seconds; one or two staged
     reels such as a making-of may run 15 to 25), and a mix of pieces with the board and nails
     showing and pieces without.
   - Take colors from `tools/reel-pipeline/palettes/colorhunt.json` (each entry is one palette,
     to be used whole). Put the palette's `name` in `meta.palette`.
   - Run `check <batch>` and fix every flagged recipe (space figures apart, or raise the outer
     one on longer nails above the inner one). Re-run until all are "ok".
   - After editing, re-run `sheets <batch> --only <ids>` and look again. Two or three rounds on a
     stubborn recipe is normal. If one still is not working after three, replace it with a
     different idea.

   Rename a recipe file when its idea changes (`07-<archetype>-<palette>.json`) but keep its
   leading two-digit id; ids must stay `01` to `20` with no gaps or duplicates.

4. **Write the words.** For every recipe, following STYLE.md:
   - `edit.captions`: a hook written for *this* clip, timed to what the sheet shows happening.
     No two reels in the batch share a hook.
   - `meta.title`: a few words Andrei will recognize the clip by on the review page.
   - `post.caption` and `post.hashtags`: specific to the clip (nail count, what number changes).
   - `edit.audio.synth`: leave the drafts' sound settings alone unless STYLE.md says otherwise.
     Andrei attaches a real track in the app when he posts, so end each `post.caption` with one
     short line suggesting the kind of track that would suit the reel ("Sound: slow piano" - a
     mood and tempo, never a specific song you cannot verify is trending).
   - `edit.handle`, if STYLE.md gives an account handle.

5. **Render.** Run `batch <batch>`. If any preview fails, read the error, fix that recipe, and
   re-run with `--only <ids>`. The review page is rewritten on every run and always lists the
   whole batch; every one of the twenty must end up with a clip.

6. **Write `batches/<batch>/NOTES.md`**, for Andrei to read alongside the review page:
   - The five you would post, in order, with one sentence each on why.
   - One line per reel: id, the idea, and anything you are unsure about.
   - Which ideas were your own rather than drafts.
   - Anything that went wrong or that you could not fix.

## Limits

- Create and edit files only inside `tools/reel-pipeline/batches/<batch>/`. Do not change the
  pipeline code, the app under `src/`, `STYLE.md`, or earlier batches. If something in the
  pipeline is broken or a recipe needs a capability that does not exist, say so in `NOTES.md`
  rather than patching it.
- Do not run `finish`: full-size renders happen only for reels Andrei picks.
- Do not commit, push, post, upload or send anything anywhere. The batch stays on this machine.
- Do not use audio files unless they are already in `tools/reel-pipeline/audio/`.

## When you are done

Reply with the path to the review page, how many of the twenty rendered, and your top five. That
reply is the whole report; keep it short.
