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
- **photos** — storage metadata (EXIF stripped before upload).
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
  non-sensitive fields, and is the only geo source granted to `anon` and normal
  `authenticated` users.
- Precise `sightings` rows are readable only by the reporter, admins, or
  authorised carers of the cat (via `has_case_access` / `has_cat_access`).

This makes "public users must not see precise GPS" a database guarantee, not a
UI convention.

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

## 8. Known limitations (M0/M1)

- Report flow, live map, matching UI, and dashboards are honest placeholders
  (clearly labelled), not fake interactive controls.
- Matching results shown are seeded; the engine itself is M3.
- No rate limiting yet (planned M6).
- Distance/proximity uses a bounding-box index + haversine, not PostGIS.
