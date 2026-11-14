# Finish picked reels

Andrei has reviewed a batch of candidate reels and chosen some to post. The message that brought
you here was copied from the batch's review page and looks like this:

```
Finish reels from batch 2026-11-11: 03, 07, 12
Notes:
- 03: hook is too long
- 09 (not picked): love the colors, camera is too fast
For next time: more build-ups, fewer captions
```

If the message picks nothing ("(none)"), there is nothing to render: run `finish <batch> --none` so
the batch is recorded as all passed over, then do step 4 with whatever notes he left.

Your job is to turn the picked ones into finished, full-size reels ready to upload, apply any
changes he asked for, and write down what his choices say about his taste so tomorrow's batch is
better. He may also phrase it loosely ("finish 3 and 7 from today, make 7 slower") - work out the
batch and ids from context, and ask only if it is truly ambiguous which reels he means.

Everything runs from the repository root through `node tools/reel-pipeline/reels.mjs <command>`.
The recipe format is in `tools/reel-pipeline/README.md` ("Recipe format (cardioid scene)"), and
the style brief is `tools/reel-pipeline/STYLE.md`.

## Steps

1. **Apply the notes on picked reels.** Each note is a change request for that reel's recipe in
   `tools/reel-pipeline/batches/<batch>/recipes/`. Edit the recipe to do what was asked: caption
   wording and timing live under `edit.captions`, pacing in `durationSeconds` and the camera
   keyframes, sound in `edit.audio`. If a note changes the picture (camera, colors, weave), run
   `sheets <batch> --only <id>` afterwards and look at the result to confirm it did what he meant.
   A note you cannot act on within the recipe format gets reported back, not ignored.

2. **Render the finals.** Run `finish <batch> <id> <id> ...` with every picked id in one call.
   This renders each at 1080x1920 with captions and sound into `batches/<batch>/final/`, writes
   the post text next to each as a `.txt`, and records the whole batch's picked/passed result in
   `feedback/history.jsonl`. Roughly thirty to forty-five seconds per reel.
   - If only captions or sound changed since a final was last rendered, add `--edit-only` to reuse
     the picture and redo just the edit.
   - If a render fails, read the error, fix the recipe, and re-run for that id with `--no-record`
     (the batch has already been recorded).

3. **Check the post text.** Read each `final/<name>.txt`. If a note changed what the reel is, make
   sure the caption and hashtags in the recipe's `post` section still describe it, and re-run with
   `--edit-only --no-record` if you change them.

4. **Update the style brief.** Add a dated entry at the top of "Learned preferences" in
   `tools/reel-pipeline/STYLE.md` covering:
   - What the picked reels have in common and what the passed-over ones share, looking at their
     recipes (archetype, palette, pace, with or without nails and board, caption style). Only
     claim a pattern the evidence supports - with three picks out of twenty, say "leaning toward",
     and say nothing where there is no pattern.
   - Every note he wrote, including notes on reels he did not pick, restated as a rule the batch
     agent can follow ("camera orbit no faster than about 20 degrees per second").
   - His "for next time" comment, as given.
   Keep entries short. If a new entry contradicts an older one, edit the older one so the section
   does not argue with itself. If he states a lasting rule about the channel itself (handle,
   length, tone), change the relevant section of the brief as well.

## Limits

- Edit only the picked reels' recipes and `STYLE.md`. Do not change pipeline code or the app.
- Do not post, upload, commit or push anything. Finished files stay in the batch folder for
  Andrei to upload himself.

## When you are done

Reply with, for each finished reel: the full path to the `.mp4`, and its caption and hashtags in a
block he can copy. Then one or two lines on what you changed from his notes and what you added to
the style brief. If he asked for a trending sound, remind him that it has to be attached in the
app at posting time.
