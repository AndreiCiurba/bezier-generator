# Persistence plan

**Status:** Phase 1 implemented (branch `feat/persistence-phase-1-browser-storage`). Phase 2 is
still just a proposal - see that section below for what it would involve. Not paired with a
progress tracker (unlike `epic-freestyle.md`/`epic-freeform-weave.md`) since this is a small,
single-PR-sized addition rather than a multi-step epic.

## Why

Today there is no persistence at all beyond manual JSON export/import (`docs/overview.md`'s own
documented rough edge). That's especially painful for the `/shapes/` + `/arrange/` pair: moving a
shape library from the Designer to the Arrange board, or an arrangement back, means exporting a
file on one page and importing it on the other every single time — even just switching tabs.

## Where things stand

- No backend, no build step, deployed as static files to GitHub Pages.
- `ShapeLibraryStore`/`ArrangedShapeStore` already serialize cleanly via `toJSON()`/`fromJSON()` —
  that exact shape is what both phases below persist, just to different places.
- All five pages (`/`, `/freestyle/`, `/3d/`, `/shapes/`, `/arrange/`) are served from the **same
  origin**, which is the key fact Phase 1 leans on.

## Phase 1 — browser storage, no accounts (✅ implemented)

Same-origin pages already share `localStorage` automatically — set a key on `/shapes/`, read it on
`/arrange/`, no file dialog involved.

- `src/io/BrowserStorage.js` — `saveToStorage`/`loadFromStorage`/`clearFromStorage`, namespaced
  (`bezier:<key>`) and JSON-serializing, every call wrapped in try/catch so an unavailable/throwing
  `localStorage` (quota exceeded, private-browsing) degrades to "nothing was saved" rather than
  crashing the page. Key names live once in `src/io/storageKeys.js`
  (`shapeLibrary:v1`/`arrangement:v1`/`shapeDraft:v1`) so `/shapes/` and `/arrange/` can't drift
  apart into two separately hand-typed strings for the shared library key.
- `/shapes/` (`ShapeDesignerApp.js`): the committed library (`ShapeLibraryStore`) auto-saves on
  every `onChange` and hydrates on load. The **in-progress draft** also persists — anchors, closed
  state, nail count/leap/height/weight settings, draw mode, and the live palette — subscribed to
  `ShapeEditorState#onChange`/`StrokePalette#onChange` (covers every anchor drag and color edit)
  plus an explicit save from each plain settings field's own change handler. A top-level "Clear
  Canvas" button wipes both keys and resets the in-memory library/editor (every dimmed committed
  shape and the in-progress one, not just the draft - "Reset Shape" is the draft-only version).
- `/arrange/` (`ArrangeApp.js`): hydrates its shape list from the *same* `shapeLibrary:v1` key
  `/shapes/` writes (read-only — it never writes that key back) and auto-saves/hydrates its own
  placed arrangement (`ArrangedShapeStore`) under `arrangement:v1`. A top-level "Clear Board"
  button wipes just that board's own key and every placed instance.
- Existing Export/Import JSON buttons were left untouched on both pages — still useful as a manual
  backup or for moving a design to a different browser/device.
- `ShapeEditorState#hydrate({anchors, closed})` (a sibling of the existing `loadPreset`, which
  always forces `closed: true`) and `ShapeLibraryStore#clear()` were added to support this cleanly.
- Went with `localStorage` (not `sessionStorage`) — persists across closing the browser, not just
  the current tab session.

## Phase 2 — real accounts + a free/cheap DB

GitHub Pages only serves static files, so some external service becomes necessary the moment
"each user's stuff is reachable from any device" is the goal. Cheapest/least-new-code first:

1. **Supabase (free tier) — recommended.** Postgres + built-in auth (email/password or magic
   link) + a JS client callable directly from a `<script type="module">` import, no custom server
   needed — the same "pull a client straight off a CDN" pattern this repo already uses for
   `uuid`/Three.js. Free tier: 500MB DB, 50K monthly active users. Row-level security
   (`user_id = auth.uid()`) replaces writing a custom per-user access-control API.
2. **Firebase (free Spark tier).** Firestore + Firebase Auth, same no-server-code model;
   Firestore's "a document is just a JSON blob" shape maps almost 1:1 onto `FreeformShape.toJSON()`.
3. **PocketBase.** A single self-hosted binary (SQLite + auth + REST API + admin UI), free and
   fully self-owned, but needs somewhere to run it (e.g. a Fly.io/Render free tier) — more setup,
   zero vendor lock-in.
4. **Custom tiny backend + Neon/Supabase Postgres**, fronted by a Vercel/Cloudflare Workers free
   tier — most flexible, most work; only worth it if 1–2's opinionated structure ever becomes
   limiting.

### Data model (reuses today's serialization as-is)

- `shapes` table: `id, user_id, name, anchors jsonb, nail_count, leap, colors jsonb, height,
  weight, created_at` — literally `FreeformShape.toJSON()`'s own fields.
- `arrangements` table: `id, user_id, name, instances jsonb, created_at` — literally
  `ArrangedShapeStore.toJSON()`'s own shape, wrapped with a name/owner.
- Auth: email/password or magic-link sign-in; the chosen provider's SDK handles session/JWT
  management, the app just checks the current user on load.

### Migration path from Phase 1

Phase 1 isn't throwaway work — Phase 2's "sync to the cloud" becomes "read what's already being
written to `localStorage`, upload it on login, pull it back down on load," with zero changes to
`FreeformShape`/`ArrangedShapeStore` themselves, only to *where* they're persisted.

## Recommended sequencing

Phase 1 fully solves the immediate "stop re-importing every time I switch pages" pain point,
today, for free, with no new service to sign up for. Only reach for Phase 2 once/if multi-device
access or sharing designs with someone else actually becomes necessary.
