# 🐾 PawPin — Drop a Pin, Save a Stray

PawPin is a location-based community web app for reporting stray cats and
coordinating their care. Anyone can report a stray in under a minute; the app
builds **persistent cat profiles** so repeat sightings form one continuous case
history, and connects volunteers, rescue organisations, and the community to
coordinate feeding, TNR, medical care, and adoption — all on a privacy-first map.

> **Build status:** this repository currently implements **Milestone M0
> (Foundation)** and **M1 (Data & Security Backbone)**. The interactive report
> flow, live map, matching UI, and dashboards land in later milestones. See
> "Milestone status" below and `.kiro/specs/pawpin/spec.md`.

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
| Map (M2+) | React Leaflet + OpenStreetMap |
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

## Project structure

```
src/
  app/            App Router pages + route handlers
  components/     UI primitives, layout, auth forms
  lib/
    supabase/     browser / server / admin clients
    auth/         role model + server guards
    validation/   Zod schemas + image validation
    env.ts        env access helper
  types/          hand-authored database types
supabase/
  migrations/     ordered SQL (schema, functions, RLS, storage)
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
- ⏭️ **M2** report flow + live map · **M3** matching engine + profiles ·
  **M4** coordination workflows · **M5** dashboards + admin · **M6** hardening ·
  **M7** docs/demo polish.

## Known limitations (M0/M1)

See `docs/testing.md` and the bottom of `docs/architecture.md` for the full
list. In brief: interactive report/map/matching/dashboards are placeholders;
matching is DB-seeded (engine ships in M3); distance uses lat/lng + haversine
(PostGIS is an optional future upgrade).
