---
name: no-e2e
description: Standing rule for this repo — do not run end-to-end/browser verification (a local static server + Playwright/Chromium, screenshots, canvas pixel sampling) after a change unless the user's current message explicitly asks for it — the word "e2e", "test with chromium", "test in the browser", "verify visually", or similarly unambiguous. This is a passive rule, not a task to run — just follow it whenever you're about to reach for a browser check.
---

# No E2E testing without an explicit ask

**Rule:** don't spin up a local server + Playwright/Chromium to visually or pixel-verify a change
unless the user's **current message** explicitly asks for E2E-style testing.

## What counts as an explicit ask

- "e2e", "run e2e", "e2e this", "e2e test it"
- "test it in chromium" / "test in the browser"
- "verify visually" / "check it renders correctly"

## What does not count

- Finishing a UI-facing change, even a substantial one — land the code + unit tests, then stop.
- General thoroughness instinct. Default to unit tests and reading the code, not a browser pass.
- An E2E ask from an earlier turn doesn't carry forward — each change needs its own ask.

## What to do instead

- Keep writing/running Vitest unit tests for pure logic — encouraged, not restricted by this rule.
- `node --check` a file if there's real doubt about a syntax error.
- Reason about the change and read the code rather than defaulting to a browser check.
- If a change feels genuinely risky enough to warrant E2E verification, **ask** whether to run it
  rather than just doing it.

## When E2E *is* requested

Use Playwright + headless Chromium against a local static server
(`python -m http.server`) — the pattern already established in this project:

1. Start the static server in the background.
2. `npm install --no-save playwright` (temporary dev dependency).
3. Write a small verification script (navigate, interact, screenshot and/or sample canvas pixel
   data directly via `getImageData` for precise, non-eyeballed checks).
4. Run it, inspect the results.
5. Clean up: delete the temp script, `npm uninstall playwright`, stop the server — so none of it
   lingers in `package.json` or the working tree afterward.
