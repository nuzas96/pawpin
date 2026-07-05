# PawPin — Testing

## Automated tests

```bash
npm run test        # Vitest unit tests
npm run typecheck   # TypeScript type checking (no emit)
npm run build       # production build (also type-checks + lints)
```

Current unit coverage (46 tests across 5 files):

**`src/lib/matching/engine.test.ts` (11 tests)**
- Identical traits at the same place/time score very high (≥95) with `high`
  confidence.
- Opposite traits, far away, long ago score below the match threshold with
  `low` confidence.
- A nearby sighting scores higher than a far sighting, all else equal.
- A recent sighting scores higher than an old sighting, all else equal.
- An `unknown` age group never scores worse than a fully-specified mismatch.
- Empty distinguishing marks / condition tags on both sides are neutral, not
  penalised.
- A shared distinguishing mark increases the score versus no shared mark.
- An ear-tip mismatch caps the score at 60 even when everything else matches,
  and surfaces an explicit "Ear-tip status" reason.
- `findPossibleMatches` filters below-threshold candidates, sorts descending,
  caps results at 5, and every result carries the required disclaimer and a
  non-empty reasons list.

**`src/lib/matching/wordingAndPrivacy.test.ts` (3 tests)**
- Generated disclaimers/reasons never contain forbidden certainty phrases
  ("same cat detected", "AI identified", "confirmed match", etc.).
- The disclaimer is always the exact required string.
- `PublicMatchCandidate`'s type has no `lat`/`lng`/`fuzzed_lat`/`fuzzed_lng`
  keys — only a derived `areaLabel`.

**`src/lib/validation/validation.test.ts` (22 tests)**
- Image validation, magic-byte detection, sign-up/sighting/comment schemas
  (as in M2), plus M3 additions: `linkSightingSchema` requires valid UUIDs for
  both `sightingId` and `catId`; `createCatFromSightingSchema` requires a
  valid `sightingId` and valid `traits` (rejecting an invalid coat colour).

**`src/lib/geo/location.test.ts` (6 tests)** and
**`src/lib/map/publicMapPrivacy.test.ts` (4 tests)** — unchanged from M2 (see
git history), still passing.

**Verified for this milestone:** `npm run build` succeeds (15 routes),
`npm run test` passes (46/46), `npm run lint` is clean, `npm run typecheck`
is clean.

## Manual QA checklist (M3 additions)

### Matching review flow (`/report`)
- [ ] Submitting a report near an existing seeded cat (e.g. the orange tabby
      at lat 1.3521, lng 103.8198) shows the Matching Review modal with at
      least one candidate, a similarity score, a confidence badge, and a
      reasons list.
- [ ] The modal shows the required disclaimer text: "PawPin suggests possible
      matches using traits, time, and approximate location. A human must
      confirm before sightings are linked."
- [ ] Clicking "Link to this cat" shows a loading state, then redirects to a
      success screen distinguishing "Sighting linked" from "New cat profile
      created" — landing on the correct existing cat's profile.
- [ ] Clicking "None of these — create a new cat profile" creates a new,
      separate cat profile instead of linking.
- [ ] Submitting a report with clearly different traits/location (e.g. the
      seeded grey senior cat's area) shows "No likely match found" and offers
      only the "create a new cat profile" action.
- [ ] After linking, the target cat's profile shows an incremented "Seen N
      times" count and a new case_events entry ("New sighting linked to this
      cat profile").
- [ ] After creating a new profile, a case_events entry reads "New cat
      profile created from sighting".

### Cat profile upgrades (`/cats/[catId]`)
- [ ] Stats bar shows "Seen N times", first seen, and last seen dates.
- [ ] A gallery of photos linked from any sighting of this cat renders (if any
      sightings had photos).
- [ ] The persistent-profile explanation text is present.
- [ ] Case timeline includes both `initial_sighting`/`new_profile_created` and
      (after a link) `sighting_linked` events, newest first.

### RLS — verify per role (Supabase SQL editor "Run as" / app sessions)
- [ ] A different authenticated user cannot call `linkSightingToCatProfile`
      on someone else's still-pending sighting (RLS blocks the update because
      `reporter_id <> auth.uid()`).
- [ ] Once a sighting is linked (`cat_id` set), only admin/`has_cat_access`
      can update it further — the original "pending, reporter-owned" update
      path no longer applies.
- [ ] `get_match_candidates(...)` is not callable by the `anon` role (only
      `authenticated`).
- [ ] Guest/anon `select * from cats_map_public` / `sighting_geo_public` still
      return only fuzzed coordinates (unchanged from M2).

### Wording contract
- [ ] No screen in the matching review flow uses "identified", "confirmed
      match", "same cat detected", or similar certainty language — verified
      automatically by `wordingAndPrivacy.test.ts` and manually by reading the
      UI copy in `MatchReviewModal.tsx` / `MatchCard.tsx`.

## How to run the seed and verify data

1. Run migrations `0001`–`0008`, then `supabase/seed.sql`.
2. Confirm: 4 profiles with distinct roles, 1 approved organisation, 7 cats
   across statuses, 7 sightings (4 for the orange tabby, one of which is
   still **pending** with `cat_id IS NULL`), 7 cases, feeding schedule + logs,
   a TNR record, an adoption, comments, a moderation flag, notifications, a
   **linked** `match_suggestions` row and a **pending** one (for the
   unresolved sighting), and `audit_logs` rows.
3. Sign in as `user@pawpin.test`. Visit `/cats/c0000000-0000-0000-0000-000000000001`
   (the orange tabby) to see the stats bar and history. Then submit a new
   report near the same location to see a live Matching Review with that cat
   as a likely candidate.
