---
name: no-push
description: Standing rule for this repo — never run `git push` (or anything that sends commits to a remote: force-push, `gh pr create`, etc.) unless the user's current prompt explicitly asks for it. This is a passive rule, not a task to run — just follow it whenever a push is about to happen.
---

# No push without an explicit ask

**Rule:** never run `git push`, `git push --force`/`--force-with-lease`, or anything else that
sends commits to a remote (opening a PR, `gh pr create` in a mode that pushes, etc.) unless the
user's **current message** explicitly asks for it.

## What counts as an explicit ask

- "push", "push this up", "push to main/origin"
- "ship it", "publish this", "open a PR" (PR creation implies a push)
- Anything else unambiguously requesting the commits leave the local repo

## What does not count

- A push authorized earlier in the conversation — it doesn't carry forward. Each push needs its
  own ask in the prompt that triggers it.
- "commit this" / "commit that" — commit locally, but don't also push.
- Finishing a task, even a big one (a refactor, a feature) — land the commit(s) locally and say
  what's ready; don't push proactively just because work is "done".
- General enthusiasm ("looks good", "nice", "great") — not a push instruction.

## What to do instead

Commit locally as normal (that's fine without asking, per the project's usual workflow). Once
committed, say plainly that it's committed locally and ready to push, and stop there. Let the
user say the word.
