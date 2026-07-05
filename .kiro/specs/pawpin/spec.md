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
- **Volunteer**: claim cases, update progress, feeding schedules/logs, TNR
  progress; precise location only for claimed/authorised cases.
- **Rescue organisation**: monitor reports, assign volunteers, manage TNR &
  adoption, verify outcomes.
- **Admin**: moderate reports, review flags, approve orgs, close/archive cases,
  view audit logs.

## 5. Data model

Tables (UUID PKs, `timestamptz`, enums, indexes): `profiles`, `organizations`,
`cats`, `sightings`, `photos`, `cases`, `case_events`, `feeding_schedules`,
`feeding_logs`, `tnr_records`, `adoptions`, `comments`, `follows`, `bookmarks`,
`notifications`, `moderation_flags`, `audit_logs`, `match_suggestions`.

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

## 7. Matching engine (M3)

Weighted, deterministic comparison of coat colour, fur pattern, size, age group,
distinguishing marks, distance, recency, and condition tags. Returns a
similarity score /100, top matches, and per-signal reasons. Safe wording:
"possible match", "similarity score", "human confirmation required". Optional AI
enhancer only when `GEMINI_API_KEY` is present; the app is fully functional
without it.

## 8. Pages

Landing, Live map, Report cat, Matching review (modal), Cat profile, Case board,
Volunteer dashboard, Org dashboard, Admin dashboard, Auth (sign in/up), Profile,
About/Impact.

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
- **M3** matching engine + profiles · **M4** coordination workflows · **M5**
  dashboards + admin · **M6** hardening · **M7** docs/demo polish.

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
