# PawPin — Demo Script

A ~5–6 minute walkthrough for judges. This reflects the M0–M3 build:
foundation, data/security backbone, the report-to-map loop, and the matching
engine plus persistent cat profiles — PawPin's core differentiator.

## Setup (before recording)

1. Run migrations 0001-0008 and supabase/seed.sql in the Supabase SQL editor.
2. In .env.local, set the Supabase URL + keys and NEXT_PUBLIC_APP_URL.
3. (Recommended) Disable "Confirm email" in Supabase Auth for a smooth sign-in.
4. npm run dev then open http://localhost:3000.
5. Have your browser location permission ready to allow (or plan to use the
   manual lat/lng fallback on stage).

## Scene-by-scene

**0:00 - The pitch (home page)**
- Open the landing page. Read the tagline: "Drop a Pin, Save a Stray."
- Point out the three differentiators: persistent cat profiles, privacy-first
  map, explainable matching.

**0:30 - The persistent profile, seeded**
- Go to the orange tabby's cat profile (/cats/c0000000-0000-0000-0000-000000000001).
  Point out the stats bar: "Seen 3 times", first seen ~30 days ago, last seen
  2 days ago - a single profile built from multiple sightings, not three
  separate reports.
- Scroll to the sighting history and case timeline.

**1:15 - Report a stray that's a likely match (the centerpiece)**
- Sign in as user@pawpin.test / PawPinDemo123.
- Go to /report. Fill in: an orange tabby, medium size, adult, a
  distinguishing mark like "notched right ear", and a location close to
  lat 1.3521, lng 103.8198 (use "Use my current location" if you're actually
  near there, or the manual fallback otherwise).
- Submit. Show the loading state, then the Matching Review modal:
  - Read the disclaimer aloud: "PawPin suggests possible matches using
    traits, time, and approximate location. A human must confirm before
    sightings are linked."
  - Point out the similarity score (e.g. 88-95/100), the confidence badge,
    and the reason list - "Coat colour: both reported as orange", "Distance:
    ~15m from a previous sighting", etc.
  - Click "Link to this cat".
- Land on the success screen ("Sighting linked"), then the cat profile - show
  the stats bar now says "Seen 4 times" and the case timeline has a new
  "New sighting linked to this cat profile" entry.

**3:00 - A report that should NOT match**
- Submit a second report: a grey, solid-coat, senior, large cat, at a
  different location (e.g. near the seeded grey cat's spot). Submit.
- Show "No likely match found" - only the "create a new cat profile" option
  is offered. Click it, and land on a brand-new, separate cat profile.
- This demonstrates the engine isn't just "always suggest something" - it's
  threshold-gated and traits-aware.

**4:00 - See it land everywhere**
- Go to /map - both the linked sighting and the new profile appear as
  separate pins (fuzzed locations only).
- Go to /cases - point out the disabled "Claim case (available in M4)"
  button - an honest placeholder, not a broken feature.

**4:45 - Data & security backbone**
- In the Supabase SQL editor: select decision, score from match_suggestions;
  - show "linked" and "rejected" rows next to the "pending" seeded example,
  demonstrating the human-confirmation audit trail.
- select * from cats_map_public; - show only fuzzed columns exist.
- Mention: matching runs server-side against precise coordinates, but nothing
  precise ever reaches the browser - enforced by a type with no lat/lng
  fields and a dedicated privacy test.

**5:30 - Where it's going**
- Mention M4 (claiming, feeding, TNR, adoption) and M5 (dashboards, admin,
  moderation). Note the optional AI adapter exists as a skeleton
  (src/lib/matching/ai-adapter.ts) for a future visual-similarity boost, but
  the app is fully functional - and was just demonstrated - without any AI key.

## Talking points to land the rubric

- Technical execution: real Postgres schema, RLS, Storage upload, a
  deterministic scoring engine with unit tests, a working end-to-end report
  to match-review to persistent-profile loop, passing build/lint/typecheck/tests.
- Innovation: the persistent cat profile concept, made real - explainable
  matching with human confirmation, not a black-box AI claim.
- Theme: full loop from spotting a cat to a linked, continuous case history
  that volunteers and rescues can act on.
- Security: RLS, coordinate fuzzing, a documented privacy boundary around the
  matching engine specifically, image validation, honest EXIF gap disclosure,
  audit logs.
- UX/UI: warm, mobile-first, accessible, real loading/empty/error states, a
  polished match review modal with plain-language reasons - no fake buttons,
  no overclaiming copy.
- Documentation: this repo's docs and spec, kept in sync with what's actually
  shipped, including the full matching weights table.
