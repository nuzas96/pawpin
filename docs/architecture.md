# PawPin — Architecture

## 1. Overview

PawPin is a Next.js (App Router) application backed entirely by Supabase
(PostgreSQL + Auth + Storage + Row Level Security). It is a genuine full-stack
app: all domain data is persisted in Postgres, access is governed by RLS, and
the app runs from a single repository with one external dependency (a Supabase
project).

```
Browser ──► Next.js App Router (server components, server actions, route handlers)
                │                          │
      Supabase JS (anon, RLS)       Supabase admin (service role, server only)
                └──────────────┬───────────┘
                               ▼
                        Supabase
        PostgreSQL (RLS) · Auth (JWT) · Storage (cat-photos)
```

## 2. Client/server boundaries

- **Browser client** (`src/lib/supabase/client.ts`) — uses the public anon key.
  All access is RLS-enforced. Used by client components (auth forms, sign-out).
- **Server client** (`src/lib/supabase/server.ts`) — cookie-bound anon client
  for Server Components, Server Actions, and Route Handlers. RLS still applies
  with the signed-in user's identity.
- **Admin client** (`src/lib/supabase/admin.ts`) — service-role key, **bypasses
  RLS**. Guarded by `import "server-only"` so the build fails if it is ever
  imported into client code. Reserved for trusted privileged operations.
- **Middleware** (`middleware.ts`) — refreshes the auth session on each request
  and redirects guests away from `/dashboard`, `/admin`, `/profile`.

Authoritative access control lives in **Postgres RLS**. Application-level
guards (`requireRole`, `RoleGate`, middleware) are defense-in-depth and UX
conveniences, not the security boundary.

## 3. Database schema

UUID primary keys, `timestamptz` everywhere, enums for constrained values, and
indexes on hot query paths. See `supabase/migrations/0002_tables.sql`.

Core entities:

- **profiles** — 1:1 with `auth.users`; holds `role` (user/volunteer/org/admin).
- **organizations** — rescue orgs; admin-approved.
- **cats** — the persistent profile (traits, status, marks, ear-tip flag).
- **sightings** — individual reports with **precise** lat/lng (RLS-protected).
- **photos** — storage metadata (EXIF stripping documented as planned hardening).
- **cases** — coordination unit tied to a cat; claimed by a volunteer / org.
- **case_events** — append-only timeline; every M4 coordination RPC appends
  a typed event here (`case_claimed`, `case_update_<category>`,
  `feeding_schedule_created`, `feeding_logged`, `tnr_update`,
  `adoption_update`, plus the M3 matching events).
- **feeding_schedules** (`frequency`: once/daily/weekly/custom,
  `next_feeding_at`) **/ feeding_logs** (`food_type`) **/ tnr_records**
  (`tnr_status`: not_started → trap_planned → trapped → surgery_scheduled →
  neutered → ear_tipped → released, plus `scheduled_at`) **/ adoptions**
  (`status`: not_available → intake → available → application_received →
  matched → adopted, adopter contact restricted by RLS) — the M4 workflows.
- **comments** (plain text), **follows**, **bookmarks**, **notifications**.
- **moderation_flags** (`status`: open → reviewing → dismissed/resolved,
  plus `resolved_by`/`resolved_at`/`resolution_note`), **audit_logs**
  (insert-only from the client's perspective; written by both the M1 DML
  trigger and, for admin actions, the M5 `log_admin_action` helper).
- **match_suggestions** — persisted matching output + human-confirmation trail
  (`decision`: `pending` | `linked` | `rejected` | `new_profile_created`,
  plus `confirmed_by`/`confirmed_at`).

### Location privacy layer

- Precise coordinates are stored only in `sightings.lat/lng`.
- The `fuzz_coordinate(double precision)` SQL function rounds to ~3 dp (~110m)
  and adds a stable per-value jitter.
- The `sighting_geo_public` **view** exposes only fuzzed coordinates plus
  non-sensitive fields; it is the per-sighting public geo source.
- The `cats_map_public` **view** (added in migration 0006) is the map's primary
  data source: one row per cat, joined via a `lateral` subquery to that cat's
  *most recent* sighting, exposing only `fuzzed_lat`/`fuzzed_lng`, urgency,
  condition tags, traits, and status — never raw coordinates. Both views are
  granted to `anon` and `authenticated`.
- Precise `sightings` rows are readable only by the reporter, admins, or
  authorised carers of the cat (via `has_case_access` / `has_cat_access`).
- A "public area label" (`src/lib/geo/location.ts` → `publicAreaLabel`) is
  derived client/server-side from the already-fuzzed coordinates, rounded to a
  coarser 2-decimal-place grid cell — intentionally less precise than the map
  pin itself, and generated without any external geocoding dependency.

This makes "public users must not see precise GPS" a database guarantee, not a
UI convention.

## 3a. Report flow (M3)

`src/components/report/ReportForm.tsx` orchestrates a section-based mobile
form (photo → location → urgency/condition → traits → notes) with client-side
Zod validation, then calls the `createSighting` server action
(`src/actions/sightings.ts`):

1. Re-validates the full payload with `sightingSchema` server-side.
2. Requires an authenticated session (see §8 "Known limitations").
3. If a photo was provided, uploads it via `uploadCatPhoto`
   (`src/lib/storage/catPhotos.ts`) — re-validates MIME/size/magic bytes,
   generates a random UUID-based storage path scoped to `<uid>/`, uploads to
   the `cat-photos` bucket, and inserts a `photos` row (rolling back the
   storage object if the DB insert fails).
4. Creates a **pending** `sightings` row (`cat_id = NULL`) with precise
   coordinates — no cat or case is created yet, avoiding duplicate profiles
   before a human decides.
5. Runs server-side candidate search (`searchMatchCandidates`, via the
   `get_match_candidates` RPC) and the matching engine (`findPossibleMatches`)
   against nearby, recent cats. Any candidates above the threshold are
   persisted to `match_suggestions` with `decision = 'pending'`.
6. Projects the results to `PublicMatchCandidate[]` (`toPublicMatchCandidates`)
   — photo URL, status, fuzzed area label, score, confidence, reasons — and
   returns them to the client. **No precise coordinates are ever sent.**
7. The client shows `MatchReviewModal`. The reporter either:
   - clicks **"Link to this cat"** on a candidate → calls
     `linkSightingToCatProfile` (`src/actions/matching.ts`), or
   - clicks **"create a new cat profile"** → calls
     `createCatProfileFromSighting`.

Both decision actions validate their input with Zod, update the sighting's
`cat_id`, open/reuse a case, append a `case_events` row, and update the
relevant `match_suggestions` rows' `decision`/`confirmed_by`/`confirmed_at` —
creating a durable human-confirmation audit trail. See §6 for the matching
engine design and §3d for the decision actions in detail.

Errors at any step (validation, upload, matching, or any insert) surface as a
specific message in the form's error state rather than a generic failure.

## 3b. Live map (M2)

`src/components/map/LiveMap.tsx` is a client component that:

- Fetches from `cats_map_public` only, via `usePublicMapData`
  (`src/lib/map/usePublicMapData.ts`), using the **browser** Supabase client
  (anon key + RLS).
- Renders `MapView` (`src/components/map/MapView.tsx`, React Leaflet + OSM
  tiles) through `next/dynamic` with `ssr: false`, because Leaflet touches
  `window` at import time and cannot be server-rendered.
- Applies client-side filters (urgency, case status, condition tag) via
  `MapFilters.tsx`.
- Implements loading, empty, and error states explicitly — no silent failures.
- Colours markers by urgency (`src/lib/map/leafletConfig.ts`) and shows a
  popup with coat/pattern, status, urgency, last-seen time, public area label,
  distinguishing marks, and a link to the cat's profile.

## 3c. Case board & cat profile (M2–M4)

- `/cases` is a server component that reads `cases` joined with `cats`, plus
  batch queries for active feeding schedules, in-progress TNR records, and
  active adoption records, and renders `CaseList` (client component) with
  status/urgency/claimed filters and quick badges (🚨 Urgent, 🍽️ Feeding
  active, ✂️ TNR active, 🏠 Adoption active). The claim button
  (`ClaimCaseButton`) is real as of M4 — see §3e.
- `/cats/[catId]` is a server component showing the cat's primary photo,
  status/urgency/trait badges, a stats bar ("Seen N times", first seen, last
  seen), case ownership and a claim button, feeding schedule/history, TNR
  status/form, adoption status/form, a case-update form, comments, follow/
  bookmark buttons, a gallery of photos linked from any sighting, and a
  combined timeline (sightings + case_events + feeding_logs — see
  `src/lib/cases/timeline.ts`). All management forms are gated by an
  `isAuthorisedCarer` server-side check (§3e) so the page never renders
  interactive controls a viewer cannot actually use.

## 3d. Matching decision actions (M3)

`src/actions/matching.ts` implements the two ways a pending sighting is
resolved:

- **`linkSightingToCatProfile({ sightingId, catId })`** — sets the sighting's
  `cat_id`; bumps the cat's `last_seen_at` if the sighting is newer; finds the
  cat's most recent case (or opens one if none exists) and appends a
  `case_events` row ("New sighting linked to this cat profile"); sets the
  chosen candidate's `match_suggestions.decision = 'linked'` (with
  `confirmed_by`/`confirmed_at`) and any other pending candidates for the same
  sighting to `'rejected'`. Trait merging is intentionally conservative (see
  §8) — marks are preserved, never overwritten.
- **`createCatProfileFromSighting({ sightingId, traits })`** — creates a new
  `cats` row from the traits collected on the report form, links the pending
  sighting to it, opens a new case, appends "New cat profile created from
  sighting", and marks any pending `match_suggestions` for the sighting as
  `'rejected'` (the reporter chose not to link to a suggested candidate).

Both actions re-validate with Zod (`linkSightingSchema`,
`createCatFromSightingSchema`) and then delegate the actual writes to
`SECURITY DEFINER` Postgres functions (`link_sighting_to_cat`,
`create_cat_from_sighting` — migration 0008). This is deliberate: a reporter
is **not** an authorised carer of the target cat, so doing these writes
directly from the action would be blocked/no-op'd by the `cats_update`,
`case_events_insert`, and `match_update` RLS policies (the M3 audit caught
exactly this). The RPCs instead:

1. run all writes in a **single transaction** (atomic — no orphan cat if a
   later step fails);
2. enforce their own authorization — the caller must be the sighting's
   reporter (or an admin) and the sighting must still be pending; and
3. for linking, require the target cat to have actually been a **suggested
   candidate** (present in `match_suggestions`) — so a user cannot link their
   sighting to an arbitrary, never-suggested cat by calling the action
   directly.

Direct table access from the browser/anon remains locked down by RLS; the
RPCs are the one narrow, audited path for a reporter to resolve their own
pending sighting.

## 3e. Volunteer coordination, feeding, TNR, adoption (M4)

The M3 audit established a pattern — writes that need role-based
authorization beyond simple row ownership must run inside a `SECURITY
DEFINER` RPC with its own explicit checks, not as a sequence of table writes
relying on RLS — and M4 applies it to every coordination write (migration
0009):

- **`claim_case(case_id)`** — requires the caller's role to be
  volunteer/org/admin (checked via `current_user_role()`); rejects
  double-claiming by a different volunteer unless the caller is an admin or a
  member of the case's own organisation (an explicit override); atomically
  sets `claimed_by`, promotes `reported → active`, appends a "Case claimed by
  volunteer" `case_events` row, and notifies the cat's followers.
- **`add_case_update(case_id, category, note)`** — requires `has_case_access`
  or admin; appends a `case_update_<category>` event (category is one of
  progress/medical/feeding/tnr/adoption/general) and notifies followers.
- **`create_feeding_schedule(...)` / `add_feeding_log(...)`** — require
  `has_case_access` or admin; append "Feeding schedule created" / "Feeding
  completed" timeline events.
- **`update_tnr_record(...)`** — requires `has_case_access` or admin; upserts
  the case's TNR record and appends a "TNR status updated to X" event. If the
  new status is `released`, it promotes the cat's and case's `status` to
  `released` **unless the cat is already `adopted` or `closed`** — a resolved
  outcome is never regressed.
- **`update_adoption_record(cat_id, status, adopter_contact)`** — requires
  `has_cat_access` or admin; upserts the cat's adoption record and appends an
  "Adoption status updated to X" event. If the new status is `adopted`, it
  promotes the cat's status and closes the most recent case **unless that
  case is already `closed`**.
- **`notify_followers(cat_id, type, payload, actor_id)`** — internal helper
  (not exposed to clients) used by every RPC above, plus a
  `notify_on_cat_status_change` trigger on `cats`, to insert a `notifications`
  row for every follower except the actor who triggered the change (no
  self-notifications).

All six RPCs are granted to `authenticated` only (never `anon`) and are
called from thin, Zod-validated server actions
(`src/actions/{cases,feeding,tnr,adoption}.ts`) that translate a raw
Postgres error (e.g. "Only volunteers, organisations, or admins can claim a
case") into a clear, role-aware message shown in the UI.

**Comments, follows, bookmarks** are the one category of M4 write that does
**not** need an RPC: `comments_insert` only checks `author_id = auth.uid()`,
and `follows_all`/`bookmarks_all` only check `user_id = auth.uid()` — every
authenticated user already satisfies these for their own rows, so
`src/actions/comments.ts` and `src/actions/follows.ts` are plain, direct
table writes.

**Notifications** are pull-based: `NotificationsBell`
(`src/components/layout/NotificationsBell.tsx`) fetches the current user's 10
most recent notifications on mount using the **browser** Supabase client
(RLS-scoped to `user_id = auth.uid()`), and marks them read when the dropdown
opens. There is no real-time/websocket layer in this milestone (see §8).

**Dashboards** (`/dashboard/volunteer`, `/dashboard/org`) are server
components built entirely from real queries — claimed cases, unclaimed
urgent cases, active feeding schedules, in-progress TNR records, and (for
org) a status-count pipeline for TNR and adoption — with no mocked data.
Both dashboards also gate on `profiles.is_approved` for their own role
(volunteer/org) — an unapproved account sees an explanatory pending-approval
message instead of the dashboard content (see §3f).

## 3f. Admin governance: roles, org approval, moderation, case governance, audit logs (M5)

M5 completes PawPin's trust/safety layer. Every write here follows the same
`SECURITY DEFINER` RPC pattern as M4 (migration 0010): each function performs
its own authorization check, all related writes atomically, and — new in
M5 — an explicit `audit_logs` row via a shared `log_admin_action(...)` helper
(distinct from the M1 trigger-based audit logging, which only fires on
`cases`/`moderation_flags`/`adoptions`/`tnr_records` DML and captures a raw
row dump rather than a purpose-built summary).

- **`update_user_role(user_id, role, is_approved, org_id)`** — admin-only.
  Refuses to let an admin remove **their own** `admin` role (self-demotion
  guard) — an admin can still change *other* admins' roles. The UI
  (`RoleEditor`) reinforces this by disabling the role `<select>` entirely
  for your own row, so the guard is visible before a request is even sent,
  not just enforced after.
- **`approve_organization` / `reject_organization`** — admin-only. Rejecting
  sets `is_approved = false` with an `admin_note` rather than deleting the
  row, so a rejected organisation can be corrected and resubmitted with full
  history intact.
- **`review_moderation_flag(flag_id, action, note)`** — admin-only, four
  actions: `dismiss`, `resolve`, `hide_comment` (requires a comment-type
  flag; also hides the underlying comment), `close_case` (requires a
  cat-type flag; closes the cat's most recent case and appends a
  `case_events` row). The flag's `status`/`resolved_by`/`resolved_at`/
  `resolution_note` update and any side effect happen in the same
  transaction.
- **`hide_comment` / `unhide_comment`** — admin-only. Comment **text is never
  modified**, only `is_hidden`; `comments_select` RLS (unchanged since M1)
  already excludes hidden comments from non-admin, non-author viewers, so
  hiding is immediately effective without any application-level filtering.
- **Case governance** — `close_case`, `reopen_case`, `archive_case`,
  `reassign_case`, `release_claim`. All require admin **or**
  `has_case_access` (the claiming volunteer or a member of the case's own
  org) — broader than admin-only, matching the spec's "admins and authorised
  orgs" requirement. `reopen_case` only succeeds from `closed`/`archived`
  (reopening an `adopted`/`released` case would contradict a resolved
  outcome — that must instead be corrected via the adoption/TNR workflow,
  which is the single source of truth for those statuses). `reassign_case`
  validates that the target user's role is volunteer/org/admin before
  assigning. Every action appends a typed `case_events` row
  (`case_closed`, `case_reopened`, `case_archived`, `case_reassigned`,
  `claim_released`).
- **`claim_case` (M4) patched in M5** to also require the caller's
  `profiles.is_approved = true` (admins exempt) — an unapproved volunteer or
  org account could previously pass the role check but should not yet be
  able to claim cases; this closes that gap.

**Admin UI** (`/admin`, `/admin/users`, `/admin/organizations`, `/admin/flags`,
`/admin/audit-logs`) is entirely server-rendered from direct Supabase queries
— the admin dashboard's stats, the users table, the organisation queue, the
flags queue, and the audit log table all read data that RLS already permits
admins to see (`profiles_select`, `organizations_select`,
`moderation_flags_select`, and the admin-only `audit_select` policy all
include an `is_admin()` branch — see §4a of `docs/security-report.md`), so no
RPC is needed for the *read* side, only for the privileged *writes* described
above.

**`FlagButton`** (`src/components/moderation/FlagButton.tsx`) lets any
signed-in user report a cat profile or a comment; the insert is a direct
table write (`mod_flags_insert` only requires `reported_by = auth.uid()`) —
no RPC needed, mirroring the M4 comments/follows/bookmarks pattern.

## 4. Auth & roles

- Supabase Auth (email/password). On sign-up, the `handle_new_user` trigger
  creates a `profiles` row with `role = 'user'`. Roles cannot be self-escalated:
  the `enforce_profile_guard` trigger blocks non-admins from changing
  `role`/`org_id`/`is_approved`.
- Role model (`src/lib/auth/roles.ts`): `guest` (unauthenticated, not stored),
  `user`, `volunteer`, `org`, `admin`.
- Server guards (`src/lib/auth/guards.ts`): `getSessionUser`, `requireUser`,
  `requireRole`.

## 5. Validation

Zod schemas (`src/lib/validation/schemas.ts`) are the single source of truth,
shared by client forms and (in later milestones) server mutation handlers.
Image validation (`src/lib/validation/image.ts`) enforces MIME allowlist
(jpg/jpeg/png/webp), an 8 MB size cap, and magic-byte detection.

## 6. Matching engine (implemented, M3)

**PawPin's persistent cat profile concept.** Instead of treating every report
as an isolated event, PawPin tries to recognise when a new sighting is likely
the *same cat* as one already in the system, and — with human confirmation —
links it into that cat's one continuous profile. This is the app's core
differentiator: it turns scattered reports into a searchable history that
volunteers and rescues can actually act on, and it reduces duplicate profiles
cluttering the map and case board.

**Design: deterministic, not AI.** The engine (`src/lib/matching/engine.ts`)
is a pure, synchronous TypeScript function — no network calls, no external
service, and therefore no cost, latency, or availability dependency. It is
fully explainable: every point of the score can be traced to a specific
signal comparison. This matters both for judge-facing transparency and for
the safety requirement that PawPin never claims certain identification.

**Signals and weights** (sum to 100):

| Signal | Weight | Notes |
|---|---|---|
| Coat colour | 22 | Similarity matrix (e.g. orange↔tabby partially similar), not just exact match |
| Distinguishing marks | 18 | Jaccard overlap of mark lists — a shared rare mark is strong evidence |
| Fur pattern | 15 | Similarity matrix |
| Distance | 15 | **Exponential decay** from haversine distance (halves every ~600m) — not a hard radius cutoff |
| Size class | 12 | Adjacent size classes score partially |
| Age group | 8 | `unknown` on either side excludes the signal entirely (never penalises) |
| Recency | 6 | Exponential decay (halves every ~14 days) |
| Condition tags | 4 | Jaccard overlap of condition tags between sightings |

**Unknown fields never punish.** Each per-signal similarity function returns
`null` when there's nothing meaningful to compare (e.g. both age groups
"unknown", or both mark lists empty). `null` signals are excluded from *both*
the numerator and the denominator before the score is normalised to 0–100 —
so a sighting with sparse data is judged only on what was actually reported,
not penalised for what wasn't.

**Ear-tip mismatch cap.** If the new sighting and a candidate disagree on
`earTipped` (a TNR marker), the final score is capped at 60 regardless of how
well other signals match — an ear-tip disagreement may mean the cat's TNR
status changed, or that it's a different cat entirely, so confidence is
deliberately capped rather than trusting the other signals.

**Confidence banding.** `similarityScore` also maps to a conservative
confidence band: **high** (≥75), **medium** (≥55), **low** (below). Even a
"high" band is presented as a *possible* match — never certainty.

**Threshold and result shape.** Only candidates scoring ≥45/100
(`MATCH_THRESHOLD`) are surfaced, capped to the top 5
(`MAX_CANDIDATES`). Every result carries the exact required disclaimer
string `"Possible match — human confirmation required"` and a `reasons[]`
array of `{ signal, contribution, detail }` built by
`src/lib/matching/explain.ts`, sorted by contribution so the strongest
evidence is shown first.

**Wording contract.** UI copy and generated reason text are restricted to:
"possible match", "similarity score", "human confirmation required",
"assisted matching". The engine and UI never say "same cat detected" or "AI
identified the cat" — enforced by an automated test
(`src/lib/matching/wordingAndPrivacy.test.ts`) that scans all generated
reason/disclaimer text for forbidden phrases.

**Privacy boundary.** Candidate search (`src/lib/matching/candidateSearch.ts`)
calls the `get_match_candidates` SQL function, which runs `SECURITY DEFINER`
and returns **precise** coordinates of each candidate's latest sighting —
but this function is only ever invoked server-side, from a server action,
using the authenticated reporter's own request-scoped Supabase client. The
raw scoring inputs and outputs never leave the server. Before anything is
sent to the browser, `toPublicMatchCandidates`
(`src/lib/matching/publicProjection.ts`) reduces each result to a
public-safe shape — photo URL, status, a fuzzed area label, score,
confidence, and reasons — with no `lat`/`lng` fields at all. This is enforced
by a TypeScript type (`PublicMatchCandidate` has no coordinate fields) and by
a unit test.

**Optional AI adapter.** `src/lib/matching/ai-adapter.ts` defines the
interface a future milestone would use to add a supplementary visual
similarity signal via the Gemini API when `GEMINI_API_KEY` is set. In M3 it
is a strict no-op — `getAiAssistScore` always returns `null` — so the app's
matching behaviour is 100% deterministic and identical whether or not the key
is present. This is a deliberate scope decision: M3 ships heuristic-assisted
matching, not AI-verified recognition, and remains fully functional without
any external API key.

## 7. Key decisions & tradeoffs

- **Supabase-only backend** over a separate API server: less run friction for
  judges, still genuinely full-stack, RLS provides real authz.
- **Fuzzing in SQL, not the client**: cannot be bypassed by a crafted request.
- **lat/lng + haversine** instead of PostGIS: zero extra setup for judges;
  PostGIS is a documented future upgrade.
- **Hand-authored DB types**: avoids requiring the Supabase CLI to build.
- **Authenticated-only reporting for M2–M5**: the `sightings_insert` RLS policy
  requires `reporter_id = auth.uid()`. Enabling true guest inserts safely would
  need either relaxing that to accept `NULL` reporter rows from `anon` (spam/
  abuse risk with zero accountability) or routing through a service-role API
  endpoint with its own rate limiting (not yet built). Rather than weaken RLS
  or bypass it without safeguards, reporting requires sign-in through M5 and
  guest reporting is deferred to M6 alongside abuse mitigation.
- **`cats_map_public` as a lateral join view**: keeps the map's "one pin per
  cat, latest sighting" semantics enforced in SQL rather than duplicated in
  client code, and guarantees fuzzing happens before any row leaves the DB.
- **No external geocoding**: the "public area label" is self-derived from the
  fuzzed coordinate grid cell, avoiding a third-party dependency/API key
  requirement for judges while remaining privacy-safe.
- **Deterministic matching over AI-first matching**: a pure TypeScript engine
  is free, instant, offline-capable, and fully explainable — every point of
  the score traces to a specific comparison. AI is additive-only (§6), never
  a requirement, which keeps the app judge-runnable with zero external keys.
- **Pending sightings instead of eager cat creation**: `sightings.cat_id` is
  nullable specifically so a sighting can exist before a human decides whether
  it belongs to an existing cat or a new one — this is what prevents duplicate
  cat profiles from being created before the matching review completes.
- **Conservative trait merging on link**: linking a sighting to an existing
  cat never overwrites or removes existing distinguishing marks; it only
  bumps `last_seen_at` when the sighting is newer. This favours data safety
  over completeness for this milestone (see §8).
- **SECURITY DEFINER RPCs for every M4 coordination write**: claim, case
  update, feeding schedule/log, TNR, and adoption all require role-based
  authorization that a plain reporter/viewer does not have — the same class
  of problem the M3 audit found in the matching decision actions. Rather than
  patch RLS policies per-action (fragile, and prone to the exact "reporter
  passes their own check but the *other* write in the same flow fails"
  no-op/throw bug found in M3), every M4 write is one atomic, self-authorizing
  RPC. Comments/follows/bookmarks are the exception — their RLS check
  (`author_id`/`user_id = auth.uid()`) is already sufficient for a direct
  table write, so no RPC is used there.
- **Never regress a resolved outcome**: `update_tnr_record` and
  `update_adoption_record` both check the cat's/case's *current* status
  before promoting it — reaching `released` or `adopted` never overwrites an
  already-`adopted`/`closed` state. This prevents a stale or out-of-order
  update from undoing a finished outcome.
- **Pull-based notifications, not real-time**: a `notifications` table plus a
  `notify_followers()` SQL helper called by every coordination RPC keeps the
  feature entirely database-backed, with no websocket/Realtime subscription
  infrastructure to run or explain to judges. The navbar bell fetches on
  mount and marks-all-read on open, which is enough to demonstrate the
  feature without the operational complexity of a live channel.
- **Explicit `log_admin_action` calls over trigger-only auditing**: the M1
  DML trigger (`log_audit_event`) captures a raw before/after row dump on
  four tables, which is a good insert-only safety net but not a readable
  audit trail. M5 admin RPCs additionally call `log_admin_action(...)`
  directly with a purpose-built `diff` (e.g. `{"before": {...}, "after":
  {...}}` for a role change, or `{"note": "..."}` for an approval) — this is
  what the audit-log viewer actually shows as the "summary" column, and it
  covers actions (role changes, org approval, flag review, case governance)
  the DML trigger does not touch at all (`profiles`, `organizations`).
- **Self-demotion guard enforced in two places, redundantly**: the
  `update_user_role` RPC refuses to let an admin remove their own `admin`
  role, and the `RoleEditor` UI disables the role `<select>` entirely for
  the signed-in admin's own row. Neither alone would be sufficient —a
  UI-only guard is trivially bypassed by calling the action directly, and a
  server-only guard without the UI hint would let an admin submit a change
  that silently fails with a generic error. Both together give a clear,
  pre-emptive UX *and* an unbypassable server-side guarantee.

## 8. Known limitations (M0–M5)

- Guest (unauthenticated) reporting is not implemented; see the tradeoff above.
- EXIF/GPS metadata stripping is not fully implemented — uploads are validated
  (MIME/size/magic bytes) but not yet re-encoded to strip embedded tags. See
  `docs/security-report.md`.
- The AI adapter is a no-op skeleton; no visual-similarity signal is computed
  yet even when `GEMINI_API_KEY` is set.
- Trait merging on link is additive-only and conservative — it does not yet
  let a reporter add a "new mark seen this time" that gets merged into the
  cat's profile; the report form's trait fields describe the *cat*, not
  per-sighting deltas.
- **Reassign takes a raw user ID, not a picker.** `CaseGovernanceActions`'
  "Reassign…" control asks for the target volunteer/org member's user ID
  directly rather than offering a searchable list of eligible users —
  functional (the RPC validates the target's role before assigning), but not
  polished. UI polish is planned for M7.
- **Notifications are pull-based, not real-time** — no websocket/live push;
  the bell fetches on page load.
- **`isAuthorisedCarer` on the cat profile page is a server-side
  approximation** of `has_case_access`/`has_cat_access` used only to decide
  whether to *render* a management form. It is not the security boundary —
  every write is independently re-checked by its RPC — so a mismatch here can
  only hide or show a form incorrectly, never bypass an authorization check.
- No rate limiting yet (planned M6).
- Distance/proximity uses a bounding-box index + haversine, not PostGIS.
