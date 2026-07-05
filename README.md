# 🐾 PawPin — Drop a Pin, Save a Stray

PawPin is a location-based community web app for reporting stray cats and
coordinating their care. Anyone can report a stray in under a minute; the app
builds **persistent cat profiles** so repeat sightings form one continuous case
history, and connects volunteers, rescue organisations, and the community to
coordinate feeding, TNR, medical care, and adoption — all on a privacy-first map.

> **Build status:** this repository currently implements **Milestone M0
> (Foundation)**, **M1 (Data & Security Backbone)**, and **M2 (Report Flow +
> Storage + Live Map)**. The report form, live map, and case board are real
> and persist to Supabase. Matching, dashboards, feeding/TNR/adoption
> workflows, and notifications land in later milestones. See "Milestone
> status" below and `.kiro/specs/pawpin/spec.md`.

---

## Problem → Solution

**Problem.** Stray-cat sightings are scattered across chat groups and social
media. The same cat is reported many times with no shared history, so feeding,
TNR, and medical care are hard to coordinate — and publicly posting exact
locations can put vulnerable animals at risk.

**Solution.** PawPin turns every sighting into part of one persistent cat
profile. A transparent, explainable matching engine suggests possible repeat
sightings (always requiring human confirmation), role-based tools let carers
coordinate, and the public map only ever shows **approximate** locations.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Styling | Tailwind CSS |
| Backend | Supabase — PostgreSQL, Auth, Storage, Row Level Security |
| Validation | Zod (shared client + server) |
| Map (M2+) | React Leaflet + OpenStreetMap (live) |
| Matching (M3) | Deterministic heuristic engine (pure TS); optional AI enhancer |
| Tests | Vitest |

---

## Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local        # then fill in your Supabase values

# 3. Run the database migrations + seed (see "Supabase setup" below)

# 4. Start the dev server
npm run dev                       # http://localhost:3000
```

Other scripts:

```bash
npm run build      # production build
npm run start      # run the production build
npm run test       # unit tests (Vitest)
npm run typecheck  # TypeScript, no emit
npm run lint       # Next.js ESLint
```

---

## Environment variables

Copy `.env.example` to `.env.local`. **Never commit real secrets** —
`.env.local` is git-ignored.

| Variable | Scope | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Anon key (RLS-enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Service role key — bypasses RLS. Never exposed to the browser. |
| `NEXT_PUBLIC_APP_URL` | public | App base URL for auth redirects (default `http://localhost:3000`) |
| `GEMINI_API_KEY` | server only, optional | Enables optional AI image analysis. **The app works fully without it.** |

Find the Supabase values in **Dashboard → Project Settings → API**.

---

## Supabase setup

1. Create a free project at [supabase.com](https://supabase.com).
2. Copy the Project URL and both API keys into `.env.local`.
3. Open the Supabase **SQL Editor** and run the migrations **in order**:
   - `supabase/migrations/0001_extensions.sql`
   - `supabase/migrations/0002_tables.sql`
   - `supabase/migrations/0003_functions.sql`
   - `supabase/migrations/0004_rls.sql`
   - `supabase/migrations/0005_storage.sql`
   - `supabase/migrations/0006_report_flow.sql`
4. (Optional but recommended for the demo) run `supabase/seed.sql`.

> Prefer the CLI? With the [Supabase CLI](https://supabase.com/docs/guides/cli)
> linked to your project you can run each file with
> `supabase db execute --file supabase/migrations/000X_*.sql`.

### Demo accounts

`seed.sql` creates four demo accounts (all password `PawPinDemo123`):

| Email | Role |
|---|---|
| `user@pawpin.test` | Registered user |
| `volunteer@pawpin.test` | Volunteer |
| `org@pawpin.test` | Rescue organisation |
| `admin@pawpin.test` | Admin |

**If your project blocks direct `auth.users` inserts**, create the four accounts
in **Dashboard → Authentication → Users → Add user** (mark emails confirmed),
then run only the non-auth sections of `seed.sql`. The profile rows are created
automatically by the `handle_new_user` trigger; a project admin can set the
volunteer/org/admin roles in the `profiles` table.

### Auth note

For the smoothest local demo, disable "Confirm email" under
**Authentication → Providers → Email** so new sign-ups get a session
immediately. With confirmation enabled, users must confirm via the emailed link
(handled by `/auth/callback`).

---

## How to report a stray cat

1. Sign in or create a free account (M2 requires authentication — see
   "Known limitations" below).
2. Go to **Report a Stray** (`/report`).
3. Add a photo (optional), capture your GPS location or enter lat/lng
   manually, pick urgency + condition tags, describe the cat's traits, and
   submit.
4. PawPin creates a new cat profile, sighting, and case immediately. There is
   no matching engine yet (M3) — every report currently makes a **new** cat
   profile even if it might be the same cat as an existing one.
5. You'll see a confirmation with a link to the new cat profile and the live map.

## How image upload works

- Photos are validated twice: once in the browser (fast feedback) and again
  on the server (MIME allowlist, 8 MB max, and a magic-byte check that the
  file's actual bytes match an allowed image format).
- Accepted files are uploaded to the `cat-photos` Supabase Storage bucket
  under a random, per-user-scoped path (`<your-user-id>/<random-uuid>.<ext>`).
  The original filename is never used as a storage path.
  See `docs/security-report.md` for the EXIF-stripping status.

## How location privacy works

- The **precise** latitude/longitude you capture is stored only in the
  RLS-protected `sightings` table — never shown on the public map.
- The public map and cat profile pages read only from privacy-preserving SQL
  views (`cats_map_public`, `sighting_geo_public`) that apply a coordinate
  **fuzzing** function before any data leaves the database. Guests and normal
  users cannot query the raw coordinates at all — RLS blocks it at the
  database layer, not just in the UI.
- A "public area label" (e.g. `Area 1.35, 103.82`) is shown instead of an
  address; it is derived from the fuzzed coordinates and is intentionally
  coarser than even the map pin.

## How the public map works

- `/map` renders an interactive React Leaflet map with OpenStreetMap tiles.
- Markers are colour-coded by urgency and show a popup with the cat's coat/
  pattern, status, urgency, last-seen time, approximate area, traits, and a
  link to its profile.
- Filters: urgency, case status, condition tag. Loading, empty, and error
  states are all implemented.

---

## Project structure

```
src/
  app/            App Router pages + route handlers
  actions/        Server Actions (e.g. createSighting)
  components/     UI primitives, layout, auth, report, map, case components
  lib/
    supabase/     browser / server / admin clients
    auth/         role model + server guards
    storage/      Supabase Storage upload helpers
    geo/          location validation + public area label
    map/          Leaflet config + public map data hook
    validation/   Zod schemas + image validation
    env.ts        env access helper
  types/          hand-authored database types
supabase/
  migrations/     ordered SQL (schema, functions, RLS, storage, report flow)
  seed.sql        demo data
docs/             architecture, security, testing, demo, checklist
.kiro/specs/pawpin/spec.md
```

See `docs/architecture.md` for the full design and `docs/security-report.md`
for the security model.

---

## Milestone status

- ✅ **M0 Foundation** — scaffold, layout/navbar/footer, all pages (real or
  honest placeholders), Supabase clients, auth (sign up/in/out, callback,
  profile creation, role guards).
- ✅ **M1 Data & Security Backbone** — full schema migrations, location-privacy
  layer (fuzz function + public view), RLS on every table with helper
  functions, storage policies, Zod validation foundation, seed data.
- ✅ **M2 Report Flow + Storage + Live Map** — real mobile-first report form
  (photo, GPS/manual location, urgency, condition tags, traits), Supabase
  Storage upload with server-side validation, `createSighting` server action
  (creates cat + sighting + case + case_event), interactive React Leaflet map
  reading only fuzzed public data, basic read-only case board, basic cat
  profile page.
- ⏭️ **M3** matching engine + profiles · **M4** coordination workflows ·
  **M5** dashboards + admin · **M6** hardening · **M7** docs/demo polish.

## Known limitations (M2)

- **Reporting requires an account.** Guest (unauthenticated) reporting is not
  implemented yet — the current RLS insert policies require `authenticated`.
  This is a deliberate, documented scope decision (see
  `docs/security-report.md`); guest reporting is planned for M3/M4.
- **No matching engine yet.** Every report creates a brand-new cat profile and
  case, even if it may be the same cat as an existing profile. The M3
  milestone adds the heuristic matching + review step.
- **EXIF/GPS metadata stripping is not fully implemented.** Uploaded photos
  are validated (type/size/magic bytes) but not yet re-encoded to strip
  embedded EXIF tags. Documented as planned hardening in
  `docs/security-report.md`.
- **No public geocoded address.** The "public area label" is a coarse
  coordinate-grid label, not a real place name (no external geocoding
  dependency by design).
- Volunteer/org/admin dashboards, feeding, TNR, adoption, comments, follows,
  bookmarks, and notifications remain placeholders until M4/M5.
