# PawPin — Security Report

This document describes PawPin's threat model and the controls implemented
through Milestone M2. Security is a layered, defense-in-depth design with
Postgres Row Level Security (RLS) as the authoritative boundary.

## 1. Threat model

| Asset | Threat | Primary control |
|---|---|---|
| Precise cat locations | De-anonymising a stray's location enables harm (poisoning, abuse, theft) | RLS + SQL coordinate fuzzing; precise coords never exposed to guests/users |
| User accounts | Privilege escalation to volunteer/org/admin | Role set server-side only; `enforce_profile_guard` trigger blocks self-escalation |
| Adopter contact info (PII) | Unauthorised access | RLS restricts `adoptions` to admins/authorised carers |
| Uploaded photos | Embedded EXIF/GPS leaks location | MIME/size/magic-byte validation now; full EXIF stripping is **planned hardening** (see §4) |
| User content | XSS via comments/notes | Stored + rendered as plain text; no `dangerouslySetInnerHTML` |
| Service role key | Full DB access if leaked to client | `server-only` import guard; never referenced in client bundles |
| Sensitive actions | Undetected abuse | Audit logging via DB triggers (insert-only, admin-read) |
| Unauthenticated report spam | Abuse via anonymous submissions | M2 requires authentication to report (see §6) |

## 2. Authentication

- Supabase Auth (email/password), JWT sessions stored in cookies.
- Middleware refreshes the session on each request.
- On sign-up, a Postgres trigger (`handle_new_user`) provisions a `profiles`
  row with `role = 'user'`. The client cannot choose its own role.

## 3. Authorization (RLS)

RLS is enabled on **every** table (`supabase/migrations/0004_rls.sql`,
extended by `0006_report_flow.sql`). Access is resolved through
`SECURITY DEFINER` helper functions with a pinned `search_path`:

- `current_user_role()`, `is_admin()`, `is_volunteer()`, `is_org()`
- `has_case_access(case_id)` — admin, the claiming volunteer, or an org member
- `has_cat_access(cat_id)` — same, across any of the cat's cases

Highlights:

- **profiles** — read own or admin; update own only; role/org/approval changes
  blocked for non-admins by the `enforce_profile_guard` trigger.
- **sightings (precise)** — readable only by reporter, admin, or authorised
  carers. Guests/normal users cannot select precise coordinates at all.
- **cats** — any authenticated user may create one (their report); updates
  require admin or `has_cat_access`.
- **cases** — a reporter may open the *initial* case for a cat they created;
  otherwise admin/org/volunteer only. A volunteer can claim an unclaimed case;
  org members manage their org's cases; admins manage all.
- **case_events** — a reporter may append the initial event on a case they
  just opened; otherwise requires `has_case_access` or admin.
- **adoptions** — restricted to admins/authorised carers (minimises PII exposure).
- **comments** — non-hidden visible to all; authors see their own; admins
  moderate (hide) via update.
- **follows/bookmarks/notifications** — strictly `user_id = auth.uid()`.
- **moderation_flags** — authenticated users file reports; only admins read/resolve.
- **audit_logs** — admin-read only; no client insert/update/delete policy, so
  rows are written exclusively by the `SECURITY DEFINER` audit trigger.

## 4. Location privacy & EXIF

- Precise coordinates live only in `sightings.lat/lng`.
- `fuzz_coordinate()` rounds to ~110m and adds stable jitter. Two views expose
  only fuzzed data: `sighting_geo_public` (per-sighting) and `cats_map_public`
  (one row per cat with its latest sighting, added in migration 0006 for the
  live map). Both are granted only fuzzed columns — never raw `lat`/`lng`.
- Because fuzzing happens in SQL and the raw columns are not selectable under
  RLS, a malicious client cannot recover precise coordinates by querying
  differently; the guarantee holds regardless of which UI is used.
- The "public area label" shown on the cat profile and in report previews
  (`src/lib/geo/location.ts`) is derived from the fuzzed coordinates rounded to
  an even coarser 2-decimal-place grid — never more precise than the public
  map pin.
- **EXIF/GPS metadata — honest status:** uploaded photos are validated
  (MIME allowlist, 8 MB max, magic-byte detection in
  `src/lib/storage/catPhotos.ts`) but are **not yet re-encoded to strip
  embedded EXIF tags**. This is a real gap: a JPEG with embedded GPS EXIF data
  could theoretically leak more precise location than the fuzzed pin if a
  carer or attacker inspected the file's metadata directly. **Planned
  hardening (M3/M6):** re-encode every accepted image server-side (strip all
  metadata, normalise to a fixed quality JPEG/WEBP) before it is written to
  Storage. Until then, users should be aware that photo metadata is not
  actively scrubbed, and PawPin's location privacy guarantee for the *map and
  profile* rests on the fuzzing layer (§ above), not on photo metadata removal.

## 5. Input & file validation

- All inputs validated with Zod schemas (`src/lib/validation/schemas.ts`),
  shared client/server; the server re-validates and never trusts the client
  (`src/actions/sightings.ts` re-parses with `sightingSchema` before any DB write).
- Images: MIME allowlist (`image/jpeg|png|webp`), 8 MB max, extension check,
  and magic-byte detection (`detectImageType`) to catch spoofed types — checked
  once client-side for UX and again server-side as the authoritative check.
- Storage uploads use a random UUID-based path (`<uploaderId>/<uuid>.<ext>`);
  the original filename is discarded and never used as a path component.
  Uploads are scoped to a `<uid>/` folder per user, enforced by both the
  Storage RLS policy and the server-side path generation.
- If the `photos` metadata insert fails after a successful Storage upload, the
  orphaned object is deleted (`uploadCatPhoto` cleanup step) to avoid
  accumulating untracked files.

## 6. Data minimisation & scope decisions

- Only necessary fields are collected; adopter contact is free-text, minimal,
  and access-restricted (M4).
- The optional reporter "guest contact" field on the report form is free-text,
  optional, and only ever readable by authorised carers on that case (same RLS
  as the rest of `sightings`/case data) — never shown publicly.
- **Reporting currently requires an authenticated account.** The `sightings`,
  `cats`, and `cases` insert policies check `auth.uid()`. We deliberately did
  **not** relax these to accept anonymous (`anon`) inserts for M2: doing so
  safely would require either (a) accepting `reporter_id IS NULL` rows from
  `anon`, which removes all accountability and invites spam/abuse with no rate
  limiting in place yet, or (b) routing guest submissions through a
  service-role endpoint, which bypasses RLS entirely and needs its own abuse
  controls we have not built. Rather than ship either unsafely, guest
  reporting is deferred to M3/M4 alongside the abuse-mitigation work
  (rate limiting, CAPTCHA) listed in §8.

## 7. Secrets hygiene

- Only `.env.example` is committed; `.env.local` and all `.env*` are git-ignored.
- The service-role key is server-only, enforced by `import "server-only"`
  (used by both `src/lib/supabase/admin.ts` and `src/lib/storage/catPhotos.ts`).
- Next.js was pinned to a patched 14.2.x release to avoid a known advisory.

## 8. Known gaps / planned (M3/M4/M6)

- **EXIF/GPS metadata stripping** — see §4. Highest-priority gap.
- Guest (unauthenticated) reporting — see §6.
- Rate limiting on report/comment endpoints.
- CAPTCHA / abuse throttling for anonymous reporting (once guest reporting ships).
- Automated RLS policy test suite (currently a manual per-role checklist —
  see `docs/testing.md`).
- Content Security Policy headers.
