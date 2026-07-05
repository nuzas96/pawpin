# PawPin — Demo Script

A ~4–5 minute walkthrough for judges. This reflects the **M0/M1/M2** build:
foundation + data/security backbone + a real report → storage → live map loop.

## Setup (before recording)

1. Run migrations `0001`–`0006` and `supabase/seed.sql` in the Supabase SQL editor.
2. In `.env.local`, set the Supabase URL + keys and `NEXT_PUBLIC_APP_URL`.
3. (Recommended) Disable "Confirm email" in Supabase Auth for a smooth sign-in.
4. `npm run dev` → open http://localhost:3000.
5. Have your browser location permission ready to allow (or plan to use the
   manual lat/lng fallback on stage).

## Scene-by-scene

**0:00 — The pitch (home page)**
- Open the landing page. Read the tagline: "Drop a Pin, Save a Stray."
- Point out the three differentiators: persistent cat profiles, privacy-first
  map, explainable matching.

**0:30 — Live map with seeded data**
- Go to `/map`. Point out the seeded pins are already there, colour-coded by
  urgency. Open a popup — show status, urgency, last seen, **area label**
  (not an address), traits, and the profile link.
- Try the urgency/status/condition filters live.
- Call out the privacy note: "Public map pins are approximate to protect cats
  and reporters."

**1:15 — Report a real stray (the core loop)**
- Sign in as `user@pawpin.test` / `PawPinDemo123`.
- Go to `/report`. Walk through the sections:
  - Add a photo — show the live preview, then try an oversized/invalid file
    to show it gets rejected with a clear message.
  - Click "Use my current location" (or enter lat/lng manually if GPS isn't
    available on the demo machine) — point out the public area label preview
    and the privacy note under the location step.
  - Pick an urgency level and a couple of condition tags (chips).
  - Fill in coat colour, pattern, size, age, and a distinguishing mark.
  - Add a short note.
- Submit. Show the loading state, then the success screen — read the
  milestone-honest text aloud: "Matching review will be added in the next
  milestone. For now, PawPin creates a new cat profile and rescue case from
  this sighting."
- Click through to the new cat profile.

**2:45 — See it land everywhere**
- On the new cat profile: show the photo, badges, sighting history (area
  label only), and the case timeline showing "Initial sighting reported."
- Go to `/map` — the new pin is there immediately (fuzzed location).
- Go to `/cases` — the new case appears; point out the disabled "Claim
  case (available in M4)" button — an honest placeholder, not a broken feature.

**3:45 — Data & security backbone**
- In the Supabase SQL editor: `select * from cats_map_public;` — show only
  `fuzzed_lat`/`fuzzed_lng` columns exist, never raw coordinates.
- Then, as the anon role, `select lat, lng from sightings;` — show it returns
  no rows (RLS blocks precise coordinates entirely).
- Briefly mention: reporting requires an account in this milestone (documented
  scope decision — guest reporting + EXIF stripping are planned next).

**4:20 — Where it's going**
- Mention M3 (matching engine — show the seeded `match_suggestions` score/
  reasons as a preview of the output shape) and M4/M5 (claiming, feeding, TNR,
  adoption, dashboards).

## Talking points to land the rubric

- **Technical execution**: real Postgres schema, RLS, Storage upload with
  server-side re-validation, a working end-to-end report to map loop, passing
  build/lint/typecheck/tests.
- **Innovation**: persistent profiles + explainable matching (preview) +
  human confirmation framing.
- **Theme**: full loop from spotting a cat to a live, coordinatable case.
- **Security**: RLS, coordinate fuzzing, image validation, honest EXIF gap
  disclosure, audit logs.
- **UX/UI**: warm, mobile-first, accessible, real loading/empty/error states,
  no fake buttons — disabled controls are labelled honestly.
- **Documentation**: this repo's docs and spec, kept in sync with what's
  actually shipped.
