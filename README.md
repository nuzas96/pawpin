# 🐾 PawPin — Drop a Pin, Save a Stray

PawPin is a location-based community web app for reporting stray cats and
coordinating their care. Anyone can report a stray in under a minute; the app
builds **persistent cat profiles** so repeat sightings form one continuous case
history, and connects volunteers, rescue organisations, and the community to
coordinate feeding, TNR, medical care, and adoption — all on a privacy-first map.

> **Build status:** this repository implements **Milestones M0–M6** —
> Foundation; Data & Security Backbone; Report Flow + Storage + Live Map;
> Matching Engine + Persistent Cat Profiles; Volunteer Coordination
> (feeding/TNR/adoption/community); Admin Moderation, Org Approval, Role
> Management, Audit Logs & Case Governance; and **M6 (Security Hardening, UX
> Polish, Deployment Readiness, Optional AI Vision)**. M6 adds rate limiting,
> security headers (CSP), dependency-free image EXIF/metadata stripping,
> upload hardening, a location-privacy audit, accessibility polish,
> deployment docs, and an optional Gemini Vision trait-suggestion feature
> that gracefully disables without an API key. Final submission packaging
> and demo-video polish land in M7. See "Milestone status" below and
> `.kiro/specs/pawpin/spec.md`.

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
   - `supabase/migrations/0007_matching.sql`
   - `supabase/migrations/0008_matching_rpcs.sql`
   - `supabase/migrations/0009_coordination.sql`
   - `supabase/migrations/0010_admin_governance.sql`
4. (Optional but recommended for the demo) run `supabase/seed.sql`.

> Prefer the CLI? With the [Supabase CLI](https://supabase.com/docs/guides/cli)
> linked to your project you can run each file with
> `supabase db execute --file supabase/migrations/000X_*.sql`.

### Demo accounts

`seed.sql` creates five demo accounts (all password `PawPinDemo123`):

| Email | Role |
|---|---|
| `user@pawpin.test` | Registered user |
| `volunteer@pawpin.test` | Volunteer |
| `org@pawpin.test` | Rescue organisation |
| `admin@pawpin.test` | Admin |
| `pending_volunteer@pawpin.test` | Volunteer, **pending approval** (M5 demo) |

**If your project blocks direct `auth.users` inserts**, create the five accounts
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

1. Sign in or create a free account (M3 still requires authentication — see
   "Known limitations" below).
2. Go to **Report a Stray** (`/report`).
3. Add a photo (optional), capture your GPS location or enter lat/lng
   manually, pick urgency + condition tags, describe the cat's traits, and
   submit.
4. PawPin saves your sighting, then runs the **matching engine** against
   nearby, recent cat profiles and shows a **Matching Review** screen:
   - If one or more **possible matches** are found, each is shown with a
     similarity score, a confidence badge, and plain-language reasons (e.g.
     "Coat colour: both reported as orange"). You choose **"Link to this
     cat"** on the right one, or **"None of these — create a new cat
     profile"** if none look right.
   - If no likely match is found, you're offered to create a new profile
     directly.
5. Linking adds this sighting to that cat's persistent history (bumping its
   "last seen" and case timeline). Creating a new profile starts a fresh
   persistent cat profile and case.
6. Either way, you land on the cat profile page, which now also shows the
   live map and the case history.

## How matching works

- PawPin compares a new sighting against existing cat profiles using a
  **deterministic, explainable heuristic engine** — no external AI call is
  required, and the app is fully functional without one.
- Signals compared: coat colour, fur pattern, size, age group, distinguishing
  marks, distance (haversine, with exponential decay — not a hard radius),
  recency (exponential decay), condition tag overlap, and an ear-tip
  (TNR marker) mismatch check that caps the score if it disagrees.
- Unknown/missing fields (e.g. an unset age group) are excluded from the score
  entirely rather than penalising the candidate.
- Output is always a **similarity score out of 100** with a confidence band
  (low/medium/high) and a list of reasons — never a claim of certain
  identification. The required disclaimer, *"Possible match — human
  confirmation required,"* is attached to every result, and a human always
  makes the final call.
- Matching runs **server-side** against precise sighting coordinates (never
  exposed to the browser); only the score, reasons, and public-safe display
  fields (photo, status, approximate area label) are sent to the client.
- See `docs/architecture.md` for the full weighting table and
  `src/lib/matching/` for the implementation.

## How volunteer coordination works

- Any **volunteer**, **rescue organisation**, or **admin** can claim an
  unclaimed case from `/cases`, a cat's profile page, or their dashboard.
  Registered users see a clear explanation that claiming requires volunteer
  access rather than a broken or hidden button.
- Claiming a case is atomic and double-claim-safe: it sets `claimed_by`,
  promotes a `reported` case to `active`, appends a "Case claimed by
  volunteer" timeline entry, and notifies the cat's followers — all inside a
  single `SECURITY DEFINER` database function (`claim_case`), so the write
  cannot partially succeed. A case already claimed by someone else is
  rejected unless the caller is an admin or a member of the case's own
  organisation (an explicit override, not a silent takeover).
- Once claimed, the volunteer (or an org member/admin) can post categorised
  case updates (progress, medical, feeding, TNR, adoption, general), manage
  feeding schedules and logs, update TNR status, and update adoption status —
  all from the cat's profile page.
- `/dashboard/volunteer` shows a volunteer's claimed cases, open unclaimed
  urgent cases nearby, today's feeding tasks, and in-progress TNR tasks.
  `/dashboard/org` shows an organisation-wide view: active/claimed/unclaimed
  case counts, unclaimed cases needing attention, and TNR/adoption pipeline
  breakdowns.

## How the feeding, TNR, and adoption workflows work

- **Feeding**: a claimed case can have a feeding schedule (frequency —
  once/daily/weekly/custom — plus a location note and next feeding time) and
  a log of completed feedings (food type, notes). Every schedule/log write
  appends a case timeline entry and is visible on the cat's profile.
- **TNR**: tracks `not_started → trap_planned → trapped →
  surgery_scheduled → neutered → ear_tipped → released`. Reaching `released`
  promotes the cat's overall status to "released" **unless it has already
  been adopted or closed** — the workflow never regresses a resolved outcome.
- **Adoption**: tracks `not_available → intake → available →
  application_received → matched → adopted`. Adopter contact information is
  minimal, optional, and **never shown publicly** — it is only ever written
  by an authorised carer and is restricted by Row Level Security to
  admins/carers on that case; the public cat profile shows only the status.
  Reaching `adopted` closes the case and promotes the cat's status.
- All three workflows are enforced by dedicated Postgres functions
  (`create_feeding_schedule`, `add_feeding_log`, `update_tnr_record`,
  `update_adoption_record`) that check the caller has access to the case
  before writing anything, so the authorization logic lives in one place.

## How community engagement works

- Any signed-in user can **comment** on a cat's profile (plain text only —
  comments are rendered as text, never as HTML), **follow** a cat to get
  notified about its updates, and **bookmark** a cat to find it again later.
  Users can also **flag** a cat profile or a comment for admin review
  (spam, inappropriate, duplicate, wrong info, abuse, other).
- Follow/bookmark state is shown directly on the profile page ("✓ Following",
  "★ Bookmarked").
- Notifications are simple and database-backed (no real-time infrastructure):
  a bell icon in the navbar shows unread in-app notifications, generated when
  a case a user follows is claimed, updated, changes status, or gets a new
  linked sighting.

## How admin governance works

- **Role & approval management** (`/admin/users`): an admin can change any
  user's role (user/volunteer/org/admin) and approval status. An admin
  **cannot demote their own account away from `admin`** — the role selector
  is disabled entirely for your own row when you're an admin, and the
  server-side RPC independently refuses the change even if the UI were
  bypassed. Every change writes an audit log entry with the before/after
  values.
- **Organisation approval** (`/admin/organizations`): pending organisations
  appear in a queue with approve/reject actions and an optional admin note.
  Rejecting does not delete the organisation — it stays available to
  correct and resubmit. Org users on an unapproved organisation see a clear
  "pending approval" message instead of the org dashboard; volunteers on an
  unapproved account see the same on their dashboard and cannot claim cases.
- **Moderation flags** (`/admin/flags`): any signed-in user can report a cat
  profile or a comment. Admins can dismiss, mark resolved, hide the
  underlying comment, or close the associated case directly from the flag —
  each action is recorded in the audit log.
- **Comment hide/unhide**: hidden comments are excluded from every normal
  viewer's query (including the comment's own author list for other users)
  but remain visible — with a "Hidden" badge and an unhide control — to
  admins. The comment text itself is never modified, only its visibility.
- **Case governance**: admins and authorised carers (the claiming volunteer
  or a member of the case's own organisation) can close, reopen, archive,
  reassign, or release the claim on a case directly from the cat profile
  page. Reopening only works from `closed`/`archived` — a case whose cat has
  reached a genuinely resolved outcome (adopted/released) is corrected via
  the adoption/TNR workflow instead, so governance actions never contradict
  a resolved outcome.
- **Audit log viewer** (`/admin/audit-logs`, admin-only, read-only): every
  admin and case-governance action writes a row with the actor, action,
  entity type/ID, a diff/summary, and a timestamp, filterable by action and
  entity type.

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

## Optional AI Vision trait suggestions

- If (and only if) a `GEMINI_API_KEY` is configured server-side, the report
  form shows a **"✨ Suggest traits with AI"** button. It sends **only the
  uploaded photo** to Google's Gemini Vision model — never location, reporter
  contact, or user identity — and returns structured, Zod-validated trait
  suggestions (coat colour, fur pattern, size, age group, visible injuries,
  possible pregnancy, distinguishing marks, confidence).
- Suggestions are applied to the form's **editable** fields — the reporter
  reviews, edits, and confirms before submitting. Wording is always advisory
  ("AI-suggested traits — please review before submitting; human confirmation
  required"), and the AI never claims to identify a *specific* cat; identity
  matching stays with the deterministic engine.
- **The app is fully functional without the key.** With no key the button
  simply doesn't appear and reporters fill traits in manually. There is no
  SDK dependency (a plain server-side `fetch` is used), so the feature never
  affects the build. See `docs/security-report.md` and `docs/architecture.md`.

## Security hardening (M6)

- **Rate limiting** on sensitive server actions (report, matching decision,
  comment, moderation flag, AI suggestion) with a friendly "Too many
  requests…" message. See `src/lib/rateLimit.ts`.
- **Security headers** including a Content-Security-Policy tuned for Leaflet /
  OpenStreetMap / Supabase, plus `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, and a `Permissions-Policy` that allows same-origin
  geolocation (used by the report flow) and disables camera/microphone. See
  `next.config.mjs`.
- **Image EXIF/metadata stripping**: uploaded JPEG EXIF/GPS/XMP and PNG text
  metadata are removed server-side before storage (dependency-free, no
  `sharp`), so a phone photo's embedded GPS can't bypass the map's fuzzing.
  See `docs/security-report.md` for the (partial WEBP) status.

## Deployment (Vercel + Supabase)

PawPin deploys as a standard Next.js app on Vercel with a Supabase backend.

1. **Supabase**: create a project, run migrations `0001`–`0010` in the SQL
   editor (in order), then `supabase/seed.sql` for demo data. Confirm the
   `cat-photos` Storage bucket exists (created by `0005_storage.sql`).
2. **Vercel**: import the repo. Set the environment variables from
   `.env.example` in the Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public)
   - `SUPABASE_SERVICE_ROLE_KEY` (server only — mark as such; never a
     `NEXT_PUBLIC_` var)
   - `NEXT_PUBLIC_APP_URL` = your deployed URL (for auth redirects)
   - `GEMINI_API_KEY` (optional; enables AI Vision)
3. In Supabase **Authentication → URL Configuration**, add your Vercel URL to
   the allowed redirect URLs so `/auth/callback` works in production.
4. Deploy. `npm run build` must pass locally first (it runs lint + typecheck).

**Production checklist**
- [ ] Migrations `0001`–`0010` applied in order; seed run (if a demo).
- [ ] All env vars set; `SUPABASE_SERVICE_ROLE_KEY` is **not** public.
- [ ] `NEXT_PUBLIC_APP_URL` matches the deployed origin.
- [ ] Auth redirect URL allow-listed in Supabase.
- [ ] "Confirm email" setting decided (off = instant demo sign-in).
- [ ] Map tiles, cat photos, and geolocation all work behind the CSP
      (verify `/map` and `/report` after deploy).
- [ ] No real secrets committed; `.env.local` is git-ignored.

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
    matching/     matching engine, weights, candidate search, AI adapter skeleton
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
- ✅ **M3 Matching Engine + Persistent Cat Profiles** — deterministic heuristic
  matching engine (`src/lib/matching/`), server-side candidate search RPC,
  a Matching Review UI shown after every report, `linkSightingToCatProfile`
  and `createCatProfileFromSighting` server actions, `match_suggestions`
  persistence with a human-confirmation trail, and an upgraded cat profile
  page (seen-count, first/last seen, linked sighting photos).
- ✅ **M4 Volunteer Coordination, Feeding, TNR, Adoption, Community Case
  Workflow** — case claim flow (role-gated, double-claim-safe), categorised
  case updates, feeding schedules/logs, full TNR tracking, adoption tracking
  with restricted adopter contact, comments/follow/bookmark, database-backed
  notifications with a navbar bell, real volunteer and organisation
  dashboards, and an upgraded case board with claim buttons and status badges.
- ✅ **M5 Admin Moderation, Organisation Approval, Role Management, Audit
  Logs, Case Governance** — real admin dashboard (user/approval/flag/case
  stats, recent audit logs, recent reports); role & approval management with
  a self-demotion guard; organisation approval queue with admin notes;
  moderation flag review (dismiss/resolve/hide comment/close case); comment
  hide/unhide with hidden-status visible only to admins; case governance
  (close/reopen/archive/reassign/release claim) available to admins and
  authorised carers; a filterable, read-only audit log viewer.
- ✅ **M6 Security Hardening, UX Polish, Deployment Readiness, Optional AI
  Vision** — per-action rate limiting; CSP + security headers; dependency-free
  image EXIF/metadata stripping on upload; upload hardening (MIME-mismatch
  rejection, friendly errors); a location-privacy audit; a skip-to-content
  accessibility link; deployment/production docs; and an optional Gemini
  Vision trait-suggestion feature (image-only, Zod-validated, graceful
  no-key fallback).
- ⏭️ **M7** final submission packaging & demo-video polish.

## Known limitations (M6)

- **Reporting requires an account.** Guest (unauthenticated) reporting is
  still not implemented — the RLS insert policies require `authenticated`.
  This remains a deliberate, documented scope decision (see
  `docs/security-report.md`); it is deferred to M7+ alongside CAPTCHA.
- **Matching is heuristic-assisted, not AI-verified.** The deterministic
  engine is the source of truth for *identity* matching (with human
  confirmation). The M6 AI Vision feature only suggests *traits* of the cat
  in a photo — it never claims two photos are the same cat.
- **Rate limiting is per-instance (in-memory).** It meaningfully throttles a
  single client on a warm instance but is not a distributed guarantee; a
  Supabase/edge-backed limiter is the documented production upgrade
  (`docs/security-report.md`).
- **WEBP metadata stripping is partial.** JPEG (EXIF/GPS/XMP) and PNG (text
  chunks) are stripped server-side before upload; WEBP is passed through
  unchanged — the one documented remaining gap.
- **Trait merging on link is conservative** (bumps `last_seen_at`, preserves
  existing marks; no per-sighting "marks seen this time" merge yet).
- **No public geocoded address.** The "public area label" is a coarse
  coordinate-grid label, not a real place name (no external geocoding
  dependency by design).
- **Reassign UI takes a raw user ID** rather than a searchable picker —
  functional, but UI polish is planned for M7.
- **Notifications are pull-based, not real-time.** The navbar bell fetches on
  page load and marks-all-read on open; there is no live/websocket push.
- **`isAuthorisedCarer` on the cat profile page is a server-side
  approximation** (claimed volunteer, org role with an org-linked case, or
  admin) used only to decide whether to *render* management forms. The
  actual authorization for every write is enforced independently by the
  SECURITY DEFINER RPCs, so a mismatch here can only hide/show a form
  incorrectly — it cannot bypass a write it shouldn't allow.
