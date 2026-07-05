# PawPin — Security Report

This document describes PawPin's threat model and the controls implemented
through Milestone M4. Security is a layered, defense-in-depth design with
Postgres Row Level Security (RLS) as the authoritative boundary.

## 1. Threat model

| Asset | Threat | Primary control |
|---|---|---|
| Precise cat locations | De-anonymising a stray's location enables harm (poisoning, abuse, theft) | RLS + SQL coordinate fuzzing; precise coords never exposed to guests/users, including during matching (see §4a) |
| User accounts | Privilege escalation to volunteer/org/admin | Role set server-side only; `enforce_profile_guard` trigger blocks self-escalation |
| Adopter contact info (PII) | Unauthorised access | RLS restricts `adoptions` to admins/authorised carers; never rendered back by the UI (see §4b) |
| Uploaded photos | Embedded EXIF/GPS leaks location | MIME/size/magic-byte validation now; full EXIF stripping is **planned hardening** (see §4) |
| User content | XSS via comments/notes | Stored + rendered as plain text; no `dangerouslySetInnerHTML` |
| Service role key | Full DB access if leaked to client | `server-only` import guard; never referenced in client bundles |
| Sensitive actions | Undetected abuse | Audit logging via DB triggers (insert-only, admin-read) |
| Unauthenticated report spam | Abuse via anonymous submissions | Reporting requires authentication (see §6) |
| Match suggestion tampering | A user linking a sighting to an unrelated/arbitrary cat, or forging a "confirmed" decision | Server-side re-validation (Zod) + RLS ownership checks on the sighting before any link/create action executes; decisions are always attributed to `auth.uid()` server-side, never client-supplied |
| Unauthorised case claiming | A normal registered user claiming a case, or a volunteer stealing another volunteer's claim | `claim_case` RPC checks the caller's role server-side and rejects re-claiming by a different, non-admin/non-org volunteer (see §4b) |
| Coordination write forgery | A user calling `add_case_update`/feeding/TNR/adoption RPCs directly for a case they have no access to | Every RPC independently checks `has_case_access`/`has_cat_access` or admin before writing anything (see §4b) |

## 2. Authentication

- Supabase Auth (email/password), JWT sessions stored in cookies.
- Middleware refreshes the session on each request.
- On sign-up, a Postgres trigger (`handle_new_user`) provisions a `profiles`
  row with `role = 'user'`. The client cannot choose its own role.

## 3. Authorization (RLS)

RLS is enabled on **every** table (`supabase/migrations/0004_rls.sql`,
extended by `0006_report_flow.sql`, `0007_matching.sql`, `0008_matching_rpcs.sql`,
and `0009_coordination.sql`). Access is resolved through `SECURITY DEFINER`
helper functions with a pinned `search_path`:

- `current_user_role()`, `is_admin()`, `is_volunteer()`, `is_org()`
- `has_case_access(case_id)` — admin, the claiming volunteer, or an org member
- `has_cat_access(cat_id)` — same, across any of the cat's cases

Highlights:

- **profiles** — read own or admin; update own only; role/org/approval changes
  blocked for non-admins by the `enforce_profile_guard` trigger.
- **sightings (precise)** — readable only by reporter, admin, or authorised
  carers. Guests/normal users cannot select precise coordinates at all. A
  reporter may also **update** their own still-**pending** sighting
  (`cat_id IS NULL`) — added in migration 0007 specifically so the matching
  review's link/create actions can set `cat_id` on a sighting that has no cat
  yet; once linked, only admin/`has_cat_access` can update it further.
- **cats** — any authenticated user may create one (their report, or the
  "create new profile" matching decision); updates require admin or
  `has_cat_access` — direct client updates are therefore blocked for a
  volunteer who hasn't claimed a case yet, which is exactly why claiming and
  every coordination write run through RPCs rather than direct table access
  (see §4b).
- **cases** — a reporter may open the *initial* case for a cat they created;
  otherwise admin/org/volunteer only. Direct client `update` still requires
  `claimed_by = auth.uid()`/org membership/admin — an unclaimed case's
  `claimed_by` can only actually be set via the `claim_case` RPC, because a
  not-yet-claiming volunteer fails that same check.
- **case_events** — a reporter may append the initial event on a case they
  just opened; otherwise requires `has_case_access` or admin.
- **feeding_schedules / feeding_logs / tnr_records** — direct client
  read is open to any authenticated user (non-sensitive coordination data);
  writes require `has_case_access` or admin, enforced identically inside the
  RPCs.
- **adoptions** — restricted to admins/authorised carers for both read and
  write (minimises PII exposure — this is the one coordination table where
  even *reading* is gated, because `adopter_contact` is PII).
- **match_suggestions** — authenticated read/insert; direct client `update`
  is restricted to admin/`has_cat_access` (so a normal user cannot forge a
  decision by writing the row directly). The legitimate decision writes
  (`pending` → `linked`/`rejected`) are performed inside the
  `link_sighting_to_cat` / `create_cat_from_sighting` SECURITY DEFINER RPCs
  (§4a), which set `confirmed_by = auth.uid()` server-side — the decision and
  its attribution can never be spoofed from the client.
- **comments** — non-hidden visible to all; authors see their own; admins
  moderate (hide) via update. Comment writes are the one M4 feature that
  remains a **direct table write** (no RPC) — see §4b for why that's safe.
- **follows/bookmarks/notifications** — strictly `user_id = auth.uid()`; also
  direct table writes for the same reason.
- **moderation_flags** — authenticated users file reports; only admins read/resolve.
- **audit_logs** — admin-read only; no client insert/update/delete policy, so
  rows are written exclusively by the `SECURITY DEFINER` audit trigger.

## 4a. Matching engine privacy boundary

The matching engine is the one place in the app that *intentionally* operates
on precise, unfuzzed coordinates — it needs real distances to score
candidates meaningfully. The privacy boundary is enforced at the data-flow
level, not just by RLS:

- `get_match_candidates(...)` (migration 0007) is a `SECURITY DEFINER` SQL
  function that returns precise candidate coordinates. It is granted to
  `authenticated` (not `anon`) and is **only ever called from a server
  action** (`src/lib/matching/candidateSearch.ts`), using the cookie-bound
  server Supabase client acting as the reporter's own session — never from a
  client component, and never with the service-role key.
- All scoring (`src/lib/matching/engine.ts`) happens in server-side memory.
  The `MatchResult`/`MatchCandidate` types that carry precise coordinates are
  never serialised to the client.
- Before any response reaches the browser, `toPublicMatchCandidates`
  (`src/lib/matching/publicProjection.ts`) maps results to
  `PublicMatchCandidate` — a type that has no `lat`/`lng`/`fuzzed_lat`/
  `fuzzed_lng` fields at all, only a derived `areaLabel` string. This is
  enforced by a unit test that inspects the type's keys and by the wording/
  privacy test suite (`src/lib/matching/wordingAndPrivacy.test.ts`).
- The two decision actions (`linkSightingToCatProfile`,
  `createCatProfileFromSighting`) take only a `sightingId` and either a
  `catId` or `traits` from the client — never coordinates — and re-derive
  everything else server-side from the already-stored sighting row. Their
  writes run inside `SECURITY DEFINER` RPCs (`link_sighting_to_cat`,
  `create_cat_from_sighting`, migration 0008) that verify the caller reported
  the sighting (or is admin), that the sighting is still pending, and — for
  linking — that the target cat was an actual suggested candidate, so the
  privileged path cannot be abused to link arbitrary cats or resolve someone
  else's sighting.

## 4b. Coordination RPC security (M4)

Claiming a case, posting a categorised case update, and managing feeding/TNR/
adoption all require **role-based** authorization that goes beyond simple row
ownership (e.g. "any volunteer, even one who has never touched this case, may
claim it if it's unclaimed" — a check RLS's row-scoped `USING`/`WITH CHECK`
clauses cannot express *before* the claim exists). Following the pattern
established by the M3 audit, every M4 coordination write is a
`SECURITY DEFINER` Postgres function (migration 0009) that performs its own
explicit authorization check and all related writes atomically:

- **`claim_case`** checks `current_user_role() in ('volunteer','org','admin')`
  and rejects claiming a case already claimed by someone else unless the
  caller is admin or shares the case's `org_id` — an explicit, auditable
  override rather than a silent takeover.
- **`add_case_update`, `create_feeding_schedule`, `add_feeding_log`,
  `update_tnr_record`** all check `has_case_access(case_id) or is_admin()`.
- **`update_adoption_record`** checks `has_cat_access(cat_id) or is_admin()`.
- Every RPC is granted `EXECUTE` to `authenticated` only — never `anon` —
  and `REVOKE ALL FROM PUBLIC` is applied first, so the grant is explicit
  rather than inherited.
- Status-transition safety is enforced *inside* the RPC, not the client:
  `update_tnr_record` and `update_adoption_record` both read the cat's/case's
  current status before writing and refuse to regress a resolved outcome
  (`adopted`/`closed`).

**Why comments/follows/bookmarks don't need an RPC:** their RLS policies
already check `author_id`/`user_id = auth.uid()`, which every authenticated
user satisfies for their own rows with no additional role logic — there is
no "claim before you can act" gap for these three tables, so a direct,
Zod-validated table write from the server action is both simpler and
equally safe.

**Adopter contact stays private end-to-end:** `AdoptionForm`
(`src/components/adoption/AdoptionForm.tsx`) is a write-only form — it never
fetches or displays a previously stored `adopter_contact` value, so even an
authorised carer's browser never receives it back after submission unless
they explicitly query the database directly (which itself remains
RLS-gated to admin/`has_cat_access`). The public cat profile only ever reads
`adoptions.status`, never `adopter_contact`.

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
  and access-restricted (implemented in M4 — see §4b).
- The optional reporter "guest contact" field on the report form is free-text,
  optional, and only ever readable by authorised carers on that case (same RLS
  as the rest of `sightings`/case data) — never shown publicly.
- **Reporting currently requires an authenticated account.** The `sightings`,
  `cats`, and `cases` insert policies check `auth.uid()`. We deliberately did
  **not** relax these to accept anonymous (`anon`) inserts for M2/M3: doing so
  safely would require either (a) accepting `reporter_id IS NULL` rows from
  `anon`, which removes all accountability and invites spam/abuse with no rate
  limiting in place yet, or (b) routing guest submissions through a
  service-role endpoint, which bypasses RLS entirely and needs its own abuse
  controls we have not built. Rather than ship either unsafely, guest
  reporting is deferred to M5 alongside the abuse-mitigation work
  (rate limiting, CAPTCHA) listed in §8.

## 7. Secrets hygiene

- Only `.env.example` is committed; `.env.local` and all `.env*` are git-ignored.
- The service-role key is server-only, enforced by `import "server-only"`
  (used by both `src/lib/supabase/admin.ts` and `src/lib/storage/catPhotos.ts`).
- Next.js was pinned to a patched 14.2.x release to avoid a known advisory.

## 8. Known gaps / planned (M5/M6)

- **EXIF/GPS metadata stripping** — see §4. Highest-priority gap.
- Guest (unauthenticated) reporting — see §6.
- Rate limiting on report/comment/matching-decision/coordination endpoints.
- CAPTCHA / abuse throttling for anonymous reporting (once guest reporting ships).
- Automated RLS policy test suite (currently a manual per-role checklist —
  see `docs/testing.md`).
- Content Security Policy headers.
- The optional AI adapter (`src/lib/matching/ai-adapter.ts`) is a no-op
  skeleton; when a real visual-similarity call is implemented in a future
  milestone, it will need its own input validation (image size/type limits
  before sending to an external API) and error handling so a third-party
  outage never blocks the deterministic matching path.
- **Admin moderation, organisation approval, and an audit-log viewer are M5.**
  Comments can be flagged (`moderation_flags`) but there is no admin UI yet
  to resolve flags or hide content — the underlying RLS and table support
  already exist from M1.
- **No case reassignment.** An org member can only see and self-claim
  unclaimed cases from the case board; assigning a specific case to a
  specific volunteer is not implemented.
