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
- **case_events** — append-only timeline.
- **feeding_schedules / feeding_logs / tnr_records / adoptions** — workflows.
- **comments** (plain text), **follows**, **bookmarks**, **notifications**.
- **moderation_flags**, **audit_logs** (insert-only, admin-read).
- **match_suggestions** — persisted matching output + human-confirmation trail.

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

## 3a. Report flow (M2)

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
4. Creates a new `cats` row (no matching engine yet — every report is a new
   profile), a `sightings` row with precise coordinates, a `cases` row, and a
   `case_events` row (`type: "initial_sighting"`).
5. Returns the new `catId`/`caseId` and a derived `areaLabel` to the client,
   which shows a success screen with the required M3 notice: *"Matching
   review will be added in the next milestone…"*

Errors at any step (validation, upload, or any insert) surface as a specific
message in the form's error state rather than a generic failure.

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

## 3c. Case board & cat profile (M2, basic)

- `/cases` is a server component that reads `cases` joined with `cats` and
  renders `CaseList` (client component) with status/urgency filters. The
  "Claim case" button is rendered **disabled** with the label "available in
  M4" — no fake interactive workflow.
- `/cats/[catId]` is a server component showing the cat's primary photo,
  status/urgency/trait badges, sighting history (via `sighting_geo_public`,
  fuzzed only), and case timeline (via `case_events`), plus a privacy note.

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

## 6. Matching engine (design, ships in M3)

A deterministic, weighted heuristic compares coat colour, fur pattern, size,
age group, distinguishing marks, distance, recency, and condition tags to
produce a **similarity score out of 100** with per-signal **reasons**. Output
is always framed as a "possible match" requiring **human confirmation**. An
optional AI adapter activates only when `GEMINI_API_KEY` is set; the engine is
fully functional without it. Seeded `match_suggestions` demonstrate the output
shape today.

## 7. Key decisions & tradeoffs

- **Supabase-only backend** over a separate API server: less run friction for
  judges, still genuinely full-stack, RLS provides real authz.
- **Fuzzing in SQL, not the client**: cannot be bypassed by a crafted request.
- **lat/lng + haversine** instead of PostGIS: zero extra setup for judges;
  PostGIS is a documented future upgrade.
- **Hand-authored DB types**: avoids requiring the Supabase CLI to build.
- **Authenticated-only reporting for M2**: the `sightings_insert` RLS policy
  requires `reporter_id = auth.uid()`. Enabling true guest inserts safely would
  need either relaxing that to accept `NULL` reporter rows from `anon` (spam/
  abuse risk with zero accountability) or routing through a service-role API
  endpoint with its own rate limiting (not yet built). Rather than weaken RLS
  or bypass it without safeguards, M2 requires sign-in and defers guest
  reporting to M3/M4 alongside abuse mitigation.
- **`cats_map_public` as a lateral join view**: keeps the map's "one pin per
  cat, latest sighting" semantics enforced in SQL rather than duplicated in
  client code, and guarantees fuzzing happens before any row leaves the DB.
- **No external geocoding**: the "public area label" is self-derived from the
  fuzzed coordinate grid cell, avoiding a third-party dependency/API key
  requirement for judges while remaining privacy-safe.

## 8. Known limitations (M0/M1/M2)

- Volunteer/org/admin dashboards, feeding, TNR, adoption, comments, follows,
  bookmarks, and notifications are still honest placeholders — they ship in
  M4/M5.
- Matching is not implemented yet (M3); every report creates a brand-new cat
  profile. Seeded `match_suggestions` demonstrate the intended output shape.
- Guest (unauthenticated) reporting is not implemented; see the tradeoff above.
- EXIF/GPS metadata stripping is not fully implemented — uploads are validated
  (MIME/size/magic bytes) but not yet re-encoded to strip embedded tags. See
  `docs/security-report.md`.
- No rate limiting yet (planned M6).
- Distance/proximity uses a bounding-box index + haversine, not PostGIS.
- Case board "claim" actions are visibly disabled, not hidden — this is
  intentional so the future workflow is legible, not a broken button.
