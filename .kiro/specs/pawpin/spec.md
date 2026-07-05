# PawPin — Specification

## 1. Overview

PawPin ("Drop a Pin, Save a Stray") is a location-based community web app for
reporting stray cats and coordinating their care. Its distinguishing feature is
**persistent cat profiles**: repeat sightings of the same cat are linked into
one continuous case history rather than isolated reports.

## 2. Problem

Stray-cat sightings are fragmented across chat groups and social media. The same
cat is reported repeatedly with no shared history, making feeding, TNR, medical
care, and adoption hard to coordinate. Publicly posting exact locations can
expose vulnerable animals to harm.

## 3. Solution

Every sighting becomes part of one persistent cat profile. A transparent,
explainable heuristic engine suggests possible repeat sightings (always
requiring human confirmation). Role-based tools let volunteers and rescue
organisations coordinate care, while the public map shows only approximate
locations.

## 4. Roles

- **Guest** (unauthenticated, not a stored DB role): view public map (fuzzed),
  report a stray.
- **Registered user**: report sightings, comment, follow, bookmark.
- **Volunteer** *(implemented M4)*: claim unclaimed cases; post categorised
  case updates; create feeding schedules and log feedings; update TNR and
  adoption status; precise location only for claimed/authorised cases.
- **Rescue organisation** *(implemented M4)*: same coordination capabilities
  as a volunteer, scoped to the org's cases; can claim/override a case
  already claimed by a volunteer in the same org; org dashboard shows
  active/claimed/unclaimed counts and TNR/adoption pipelines.
- **Admin** *(implemented M5)*: all volunteer/org capabilities on every case,
  plus role/approval management (with a self-demotion guard), organisation
  approval/rejection, moderation flag review (dismiss/resolve/hide comment/
  close case), comment hide/unhide, case governance (close/reopen/archive/
  reassign/release claim), and a filterable, read-only audit log viewer.

## 5. Data model

Tables (UUID PKs, `timestamptz`, enums, indexes): `profiles`, `organizations`,
`cats`, `sightings`, `photos`, `cases`, `case_events`, `feeding_schedules`,
`feeding_logs`, `tnr_records`, `adoptions`, `comments`, `follows`, `bookmarks`,
`notifications`, `moderation_flags`, `audit_logs`, `match_suggestions`.

M4 additions: `feeding_schedules.frequency` (once/daily/weekly/custom) +
`next_feeding_at`; `feeding_logs.food_type`; `tnr_status` enum expanded to
`not_started → trap_planned → trapped → surgery_scheduled → neutered →
ear_tipped → released` (plus legacy `recovering`/`returned` values retained
for backward compatibility) with `tnr_records.scheduled_at`; `adoptions.status`
constrained to `not_available → intake → available → application_received →
matched → adopted`.

M5 additions: `case_status` enum gains `archived` (distinct from `closed` —
archived means set aside without implying a resolved outcome);
`moderation_flags.status` constrained to `open → reviewing → dismissed/
resolved` with `resolved_at`/`resolution_note`; `organizations.admin_note`
for approval/rejection reasoning.

Location privacy: precise coords in `sightings`; `fuzz_coordinate()` +
`sighting_geo_public` view expose only approximate coords per-sighting;
`cats_map_public` view (added M2) exposes one fuzzed row per cat joined to its
latest sighting, powering the live map without ever selecting raw coordinates.

See `supabase/migrations/` for the authoritative schema.

## 6. Security requirements

- Supabase Auth + RLS on every table + role-based access control.
- Helper functions: `current_user_role`, `is_admin`, `is_volunteer`, `is_org`,
  `has_case_access`, `has_cat_access`.
- Precise GPS never exposed to guests/normal users.
- Zod validation (client + server); image validation (MIME/size/magic bytes).
- Plain-text user content; audit logs insert-only + admin-read.
- No unnecessary PII; service-role key server-only; no committed secrets.
- Role-based coordination writes (claim, case update, feeding, TNR, adoption)
  run through `SECURITY DEFINER` RPCs that perform their own authorization
  check and all related writes atomically — not through direct table access
  relying solely on RLS — because RLS's row-scoped policies cannot express
  "any volunteer may claim this case" before the claim exists. See
  `docs/architecture.md` §3e and `docs/security-report.md` §4b.
- Admin governance writes (role/approval change, org approve/reject,
  moderation flag review, comment hide/unhide, case governance) follow the
  same RPC pattern, each independently re-checking `is_admin()` (or
  admin-or-case-access for governance) and writing an explicit `audit_logs`
  row via a `log_admin_action` helper with no client-facing grant of its
  own. An admin cannot demote their own account away from `admin`. See
  `docs/architecture.md` §3f and `docs/security-report.md` §4c.

## 7. Matching engine (M3, implemented)

Weighted, deterministic comparison of coat colour (22), fur pattern (15),
distinguishing marks (18), distance (15), size class (12), age group (8),
recency (6), and condition tags (4) — total 100. Distance uses haversine with
exponential decay (not a hard radius); recency uses exponential decay.
Unknown/missing fields are excluded from scoring entirely rather than
penalising the candidate. An ear-tipped mismatch caps the score at 60.

Returns the top 5 candidates scoring ≥45/100, each with a similarity score,
a conservative confidence band (low/medium/high), and per-signal reasons.
Safe wording only: "possible match", "similarity score", "human confirmation
required", "assisted matching" — never "same cat detected" or "AI identified
the cat" (enforced by an automated wording test). Optional AI enhancer
(`src/lib/matching/ai-adapter.ts`) activates only when `GEMINI_API_KEY` is
present, and is a strict no-op in this milestone; the app is fully functional
without it.

Sightings are created **pending** (`cat_id = NULL`); the reporter's decision
via the Matching Review UI — link to an existing cat or create a new profile
— is what actually assigns `cat_id`, preventing duplicate cat profiles from
being created before a human confirms. See `docs/architecture.md` §6 for the
full design and `src/lib/matching/` for the implementation.

## 8. Pages

Landing, Live map, Report cat, Matching review (modal), Cat profile, Case board,
Volunteer dashboard *(implemented M4)*, Org dashboard *(implemented M4)*,
Admin dashboard + Users + Organizations + Flags + Audit Logs
*(implemented M5)*, Auth (sign in/up), Profile, About/Impact.

## 9. Milestones

- **M0 Foundation** — scaffold, layout, pages, Supabase clients, auth + guards.
- **M1 Data & Security Backbone** — schema, location privacy, RLS, storage
  policies, validation foundation, seed data.
- **M2 Report Flow + Storage + Live Map** *(implemented)* — real report form
  (photo, GPS/manual location, urgency, condition tags, traits, optional
  guest contact) validated client + server with Zod; `createSighting` server
  action uploads the photo (`uploadCatPhoto`, MIME/size/magic-byte
  re-validation, random per-user storage path) and creates a new cat + case +
  initial `case_events` timeline entry (authenticated users only for this
  milestone — see spec §6 and `docs/security-report.md`); interactive React
  Leaflet + OSM live map reading only the fuzzed `cats_map_public` /
  `sighting_geo_public` views, with urgency/status/condition filters and
  loading/empty/error states; read-only case board with disabled claim
  buttons; basic cat profile page with sighting history and case timeline.
- **M3 Matching Engine + Persistent Cat Profiles** *(implemented)* —
  deterministic heuristic matching engine (`src/lib/matching/`) with unit
  tests covering scoring behaviour and the wording/privacy contract;
  server-side candidate search (`get_match_candidates` RPC + haversine
  scoring) that never leaks precise coordinates to the client; the report
  flow now creates a **pending** sighting and shows a Matching Review UI
  (`MatchReviewModal`, `MatchCard`, `ScoreBadge`) with public-safe candidate
  data; `linkSightingToCatProfile` and `createCatProfileFromSighting` server
  actions resolve the pending sighting and persist the human's decision to
  `match_suggestions` (`pending` → `linked`/`rejected`/`new_profile_created`);
  the cat profile page is upgraded with a "seen N times"/first-seen/last-seen
  stats bar, a linked-photo gallery, and a persistent-profile explanation.
- **M4 Volunteer Coordination, Feeding, TNR, Adoption, Community Case
  Workflow** *(implemented)* — six `SECURITY DEFINER` RPCs
  (`claim_case`, `add_case_update`, `create_feeding_schedule`,
  `add_feeding_log`, `update_tnr_record`, `update_adoption_record`,
  migration 0009) each performing self-authorization + atomic writes +
  `notify_followers()`; role-gated claim flow with double-claim prevention
  and an explicit admin/org override; full feeding schedule/log, TNR
  (7-status workflow), and adoption (6-status workflow) tracking with
  never-regress-a-resolved-outcome safety; categorised case updates;
  comments/follow/bookmark (direct table writes — RLS ownership checks are
  already sufficient); database-backed notifications with a navbar bell;
  real volunteer and organisation dashboards; upgraded case board (claimed
  filter + quick badges) and cat profile (claim button, feeding/TNR/adoption
  sections, case update form, comments, combined timeline).
- **M5 Admin Moderation, Organisation Approval, Role Management, Audit
  Logs, Case Governance** *(implemented)* — 11 `SECURITY DEFINER` RPCs
  (`update_user_role` with a self-demotion guard, `approve_organization`/
  `reject_organization`, `review_moderation_flag` with 4 actions,
  `hide_comment`/`unhide_comment`, `close_case`/`reopen_case`/`archive_case`/
  `reassign_case`/`release_claim`, migration 0010) each self-authorizing and
  writing an explicit `audit_logs` row via `log_admin_action`; `claim_case`
  (M4) patched to also require approval; a real admin dashboard (`/admin`)
  with live stats, recent audit logs, and recent reports; `/admin/users`
  (role/approval management with the self-demotion guard reinforced in the
  UI), `/admin/organizations` (approval queue with admin notes),
  `/admin/flags` (open/reviewed moderation queue), `/admin/audit-logs`
  (filterable, read-only); a `FlagButton` on cat profiles/comments; case
  governance controls on the cat profile page gated to admins/authorised
  carers.
- **M6** hardening · **M7** docs/demo polish.

## 10. Acceptance criteria

**M0/M1**
- `npm install`, `npm run dev`, and `npm run build` all succeed.
- All pages reachable; no broken navigation; no console errors on load.
- Auth sign up/in/out works; profile auto-created with `role = 'user'`.
- RLS enabled on all tables; precise coordinates not readable by guests/users.
- Fuzz function + public view present and used.
- Storage bucket + policies defined.
- Zod schemas + image validation present with passing tests.
- Seed data covers all listed entities.

**M2**
- An authenticated user can submit a report (photo optional, GPS or manual
  lat/lng, urgency, condition tags, traits, notes, optional contact) and it
  persists as a new `cats` + `sightings` + `cases` + `case_events` row set.
- Uploaded photos are validated server-side (MIME/size/magic bytes) and stored
  under a random, per-user-scoped path; metadata is recorded in `photos`.
- The live map renders real data from `cats_map_public` only, with working
  urgency/status/condition filters and loading/empty/error states.
- The case board lists real cases with disabled (not fake) claim buttons.
- The cat profile page shows real data including fuzzed sighting history and
  the case timeline.
- Public map/profile data never includes raw `lat`/`lng` (enforced by RLS and
  covered by an automated test).
- Documentation explains the report flow, image upload, location privacy, and
  what remains for M3.
- `npm run build`, `lint`, `typecheck`, and `test` all pass.

**M3**
- Submitting a report creates a **pending** sighting (`cat_id = NULL`), not an
  immediate new cat profile.
- The matching engine runs server-side and returns candidates scoring
  ≥45/100, each with a score, confidence band, and reasons; results sent to
  the client never include raw `lat`/`lng` (enforced by a typed projection and
  an automated test).
- The Matching Review UI shows the required disclaimer text verbatim and
  offers both "link to this cat" and "create a new profile" paths.
- Linking a sighting updates `cat_id`, bumps `last_seen_at` when appropriate,
  opens/reuses a case, appends a `case_events` row, and updates
  `match_suggestions.decision` to `linked` (chosen) / `rejected` (others).
- Creating a new profile from a pending sighting creates a new `cats` row,
  links the sighting, opens a case, appends a `case_events` row, and marks any
  pending `match_suggestions` as `rejected`.
- Neither decision action trusts client-supplied ownership — both re-validate
  with Zod and rely on RLS to confirm the caller may act on the sighting.
- The cat profile page shows a "seen N times" count, first/last seen dates,
  and a persistent-profile explanation.
- No UI or generated text uses forbidden certainty language ("same cat
  detected", "AI identified the cat", etc.) — covered by an automated test.
- `npm run build`, `lint`, `typecheck`, and `test` all pass (46/46 tests).

**M4**
- A volunteer/org/admin can claim an unclaimed case; a plain registered user
  sees an explanatory message instead of a claim button, never a broken or
  hidden control.
- Claiming atomically sets `claimed_by`, promotes `reported → active`,
  appends a "Case claimed by volunteer" `case_events` row, and notifies the
  cat's followers — verified via the `claim_case` RPC.
- Double-claiming by a different, non-admin/non-org volunteer is rejected;
  an admin or a member of the case's own organisation may override.
- An authorised carer can create a feeding schedule (frequency, description,
  optional location/next-feeding-time) and log feedings (food type, notes);
  both appear on the cat profile and in the case timeline.
- An authorised carer can move a TNR record through all 7 statuses; reaching
  `released` promotes the cat/case status to `released` unless already
  `adopted`/`closed`.
- An authorised carer can move an adoption record through all 6 statuses;
  reaching `adopted` promotes the cat status and closes the case unless
  already closed. Adopter contact is never rendered back by the UI and is
  RLS-restricted to admin/authorised-carer reads.
- Any authenticated user can comment (rendered as plain text, never HTML),
  follow/unfollow, and bookmark/unbookmark a cat; state persists and is
  reflected correctly after a page reload.
- Notifications are created for case claims, case updates, TNR updates,
  adoption updates, and new linked sightings, and are visible via a navbar
  bell that marks them read on open.
- `/dashboard/volunteer` and `/dashboard/org` show real data (claimed cases,
  open urgent cases, feeding/TNR tasks, pipeline breakdowns) with no mocked
  content; both are role-guarded.
- `/cases` supports status/urgency/claimed filters and shows quick badges
  (feeding/TNR/adoption active, urgent, unclaimed).
- Every coordination write is re-validated with Zod and independently
  re-checks authorization server-side (RPC or RLS ownership check) — no
  write trusts a client-supplied role or ownership claim.
- `npm run build`, `lint`, `typecheck`, and `test` all pass (73/73 tests).

**M5**
- A non-admin cannot access any `/admin/*` page (role guard redirects) and
  cannot successfully call any admin RPC directly (each independently
  checks `is_admin()` or admin-or-case-access server-side).
- An admin can change any user's role and approval status; the admin cannot
  demote their **own** account away from `admin` (enforced by both a
  disabled UI control and an independent server-side RPC check). Every
  change writes an `audit_logs` row with before/after values.
- An admin can approve or reject a pending organisation with an optional
  note; rejecting preserves the organisation row (never deletes it). Org/
  volunteer users on an unapproved account see a "pending approval" message
  instead of their dashboard and cannot claim cases.
- An admin can dismiss, resolve, hide-the-underlying-comment, or
  close-the-associated-case directly from an open moderation flag; each
  action updates the flag's status and writes an audit log row.
- Hidden comments are excluded from every normal viewer's query (verified by
  an automated test) but remain visible, with a "Hidden" badge and an
  unhide control, to admins. Comment text is never modified by moderation.
- Admins and authorised carers (claiming volunteer or org member) can close,
  reopen, archive, reassign, or release the claim on a case; each action
  appends a `case_events` row and an audit log row. Reopening only succeeds
  from `closed`/`archived` — never from an `adopted`/`released` case.
- The audit log viewer is admin-only, read-only, and supports filtering by
  action and entity type.
- `npm run build`, `lint`, `typecheck`, and `test` all pass (97/97 tests).
