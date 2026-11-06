# Persistence plan (proposal — not implemented)

**Status:** plan only, written up on request. Nothing in this doc has been built yet; see the
two phases below for what each would involve. Not paired with a progress tracker (unlike
`epic-freestyle.md`/`epic-freeform-weave.md`) since no phase has been started.

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

## Phase 1 — browser storage, no accounts (do this first)

Same-origin pages already share `localStorage`/`sessionStorage` automatically — set a key on
`/shapes/`, read it on `/arrange/`, no file dialog involved.

- New small module, e.g. `src/io/BrowserStorage.js`: versioned, namespaced keys
  (`bezier:shapeLibrary:v1`, `bezier:arrangement:v1`), JSON serialize/parse, graceful fallback if
  storage throws (quota exceeded / private-browsing mode).
- `ShapeLibraryStore`/`ArrangedShapeStore` auto-save to that key on every `onChange`, and hydrate
  from it on page load.
- Existing Export/Import JSON buttons stay as-is — still useful as a manual backup or for moving a
  design to a different browser/device, just no longer *required* for everyday same-browser use.
- **`localStorage` vs `sessionStorage`:** `sessionStorage` clears the moment the tab closes;
  `localStorage` persists until explicitly cleared. Defaulting to `localStorage` unless an
  explicitly ephemeral "forget everything when I close the tab" behavior is wanted instead (a
  one-line swap either way).
- Storage budget: a shape/arrangement is a few KB of JSON each; the typical 5–10MB-per-origin cap
  comfortably holds hundreds of them.
- Zero new infrastructure, works today on GitHub Pages as-is, fully reversible.

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

Do Phase 1 now — it fully solves the immediate "stop re-importing every time I switch pages" pain
point, today, for free, with no new service to sign up for. Only reach for Phase 2 once/if
multi-device access or sharing designs with someone else actually becomes necessary.
