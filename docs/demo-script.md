# PawPin — Demo Script

A ~3–4 minute walkthrough for judges. This reflects the **M0/M1 foundation**
build; steps marked *(planned)* describe where later milestones plug in.

## Setup (before recording)

1. Run migrations `0001`–`0005` and `supabase/seed.sql` in the Supabase SQL editor.
2. In `.env.local`, set the Supabase URL + keys and `NEXT_PUBLIC_APP_URL`.
3. (Recommended) Disable "Confirm email" in Supabase Auth for a smooth sign-in.
4. `npm run dev` → open http://localhost:3000.

## Scene-by-scene

**0:00 — The pitch (home page)**
- Open the landing page. Read the tagline: "Drop a Pin, Save a Stray."
- Point out the three differentiators: persistent cat profiles, privacy-first
  map, explainable matching.

**0:30 — The problem & privacy stance (About page)**
- Navigate to About. Highlight the problem statement and the privacy paragraph:
  the public only ever sees **approximate** locations; precise GPS is restricted
  to authorised carers.

**1:00 — Sign in as different roles**
- Sign in as `admin@pawpin.test` / `PawPinDemo123`. Show the navbar now shows
  the Admin link and the role badge.
- Visit `/admin` — it loads (role guard passes).
- Sign out, sign in as `user@pawpin.test`. Visit `/admin` — you are redirected
  (role guard blocks non-admins). This demonstrates route guarding.

**1:45 — Data & security backbone (the real M1 story)**
- In the Supabase SQL editor, run `select * from sighting_geo_public;` — show
  fuzzed coordinates.
- Then run `select lat, lng from sightings;` as the anon role — show it returns
  no rows (RLS blocks precise coordinates).
- Show the seeded orange tabby has **three** sightings tied to **one** cat
  profile — the persistent-profile concept.
- Show `select * from audit_logs;` — rows were auto-created by triggers when the
  seed inserted cases/TNR/adoptions.

**2:45 — Matching output shape**
- Show `select score, reasons from match_suggestions;` for the orange tabby:
  score 88/100 with per-signal reasons and a "possible match" framing.
- Explain: in M3 this is produced live by a deterministic engine and always
  requires human confirmation.

**3:15 — Where it's going**
- Briefly show the Report / Map / Cases placeholder pages, which honestly state
  the interactive flow ships in M2–M5 on top of this backbone.

## Talking points to land the rubric

- **Technical execution**: real Postgres schema, RLS on every table, migrations,
  passing build + tests.
- **Innovation**: persistent profiles + explainable matching + human confirmation.
- **Theme**: end-to-end stray-cat lifecycle; privacy protects the animals.
- **Security**: RLS, coordinate fuzzing, EXIF stripping, Zod, audit logs.
- **UX/UI**: warm, mobile-first, accessible, honest placeholders (no fake buttons).
- **Documentation**: this repo's `docs/` + spec.
