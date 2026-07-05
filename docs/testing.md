# PawPin — Testing

## Automated tests

```bash
npm run test        # Vitest unit tests
npm run typecheck   # TypeScript type checking (no emit)
npm run build       # production build (also type-checks + lints)
```

Current unit coverage (26 tests across 3 files):

**`src/lib/validation/validation.test.ts` (16 tests)**
- Image validation: valid JPEG accepted; unsupported MIME rejected; >8 MB
  rejected; spoofed extension rejected.
- Magic-byte detection: PNG and JPEG signatures detected; junk returns null.
- Zod schemas: short passwords rejected; valid sign-up accepted; out-of-range
  coordinates rejected; valid sighting accepted; comment requires a target;
  invalid condition tag rejected; valid multi-tag condition list accepted;
  optional guest contact accepted; missing latitude rejected.

**`src/lib/geo/location.test.ts` (6 tests)**
- Latitude/longitude range validation (valid and invalid boundary values).
- `publicAreaLabel` produces the expected coarse label and never reveals more
  than 2 decimal places of precision.

**`src/lib/map/publicMapPrivacy.test.ts` (4 tests)**
- The `cats_map_public` and `sighting_geo_public` TypeScript row types expose
  only `fuzzed_lat`/`fuzzed_lng` — never `lat`/`lng` keys.
- Static assertions against the SQL migration source confirm both views
  compute coordinates through `fuzz_coordinate(...)` and do not select raw
  `lat`/`lng` as bare output columns.

**Verified for this milestone:** `npm run build` succeeds (15 routes,
including the new `/cats/[catId]` dynamic route), `npm run test` passes
(26/26), `npm run lint` is clean, `npm run typecheck` is clean.

## Manual QA checklist (M2 additions)

### Report flow (`/report`)
- [ ] Signed out: page shows a "sign in to report" notice with links, not a
      broken or fake form.
- [ ] Signed in: photo upload accepts jpg/png/webp, rejects other types and
      files over 8 MB, and shows a live preview.
- [ ] "Use my current location" populates lat/lng (browser permission prompt
      appears); denying permission shows an inline error and the manual
      fields remain usable.
- [ ] Manual lat/lng entry rejects out-of-range values with a visible message.
- [ ] Submitting without a location shows a clear validation error.
- [ ] Submitting a complete report shows a loading state, then a success
      screen containing the required text: "Matching review will be added in
      the next milestone. For now, PawPin creates a new cat profile and
      rescue case from this sighting."
- [ ] Success screen links to the new cat profile and to the live map.
- [ ] After submission, a new row exists in `cats`, `sightings`, `cases`, and
      `case_events` (type `initial_sighting`).

### Live map (`/map`)
- [ ] Shows a loading state briefly, then either markers or an empty-state
      message (never a blank white area).
- [ ] Markers are coloured by urgency; clicking one opens a popup with coat/
      pattern, status, urgency, last-seen, area label, marks, and a working
      link to the cat profile.
- [ ] Urgency / status / condition filters narrow the visible markers; clearing
      filters restores them.
- [ ] Temporarily breaking the Supabase URL/key in `.env.local` and reloading
      shows the error state, not a crash.
- [ ] Layout is usable on a narrow (mobile) viewport.

### Case board (`/cases`)
- [ ] Lists cases with status + urgency badges; filters narrow the list.
- [ ] "Claim case" button is visibly disabled and labelled "available in M4"
      — not a functioning or misleading control.
- [ ] Each case with a cat links to `/cats/[catId]`.

### Cat profile (`/cats/[catId]`)
- [ ] Shows the primary photo (or a placeholder if none), status/urgency/trait
      badges, distinguishing marks, and the privacy note.
- [ ] Sighting history lists entries with the **public area label**, never raw
      coordinates.
- [ ] Case timeline lists `case_events` in reverse-chronological order.
- [ ] Visiting a non-existent cat id renders a 404, not a crash.

### RLS — verify per role (Supabase SQL editor "Run as" / app sessions)
- [ ] **Guest/anon**: `select * from cats_map_public` and
      `select * from sighting_geo_public` return fuzzed coords only;
      `select lat, lng from sightings` returns **no rows**.
- [ ] **Registered user**: can insert their own sighting/cat/case/case_event
      (M2 report flow); cannot read another user's precise `sightings` row.
- [ ] A non-admin `update profiles set role='admin'` is rejected by the guard.

### Location privacy
- [ ] `fuzz_coordinate(1.3521)` differs from the raw value and is stable across
      calls.
- [ ] The public views never expose raw `lat`/`lng` column names (also covered
      by the automated `publicMapPrivacy.test.ts`).

## How to run the seed and verify data

1. Run migrations `0001`–`0006`, then `supabase/seed.sql`.
2. Confirm: 4 profiles with distinct roles, 1 approved organisation, 7 cats
   across statuses, 6 sightings (3 for the orange tabby), 7 cases, feeding
   schedule + logs, a TNR record, an adoption, comments, a moderation flag,
   notifications, seeded `match_suggestions`, and `audit_logs` rows.
3. Sign in as `user@pawpin.test`, submit a new report via `/report`, and
   confirm it appears immediately on `/map` and `/cases`.
