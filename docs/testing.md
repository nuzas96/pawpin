# PawPin — Testing

## Automated tests

```bash
npm run test        # Vitest unit tests
npm run typecheck   # TypeScript type checking (no emit)
npm run build       # production build (also type-checks + lints)
```

Current unit coverage (`src/lib/validation/validation.test.ts`, 12 tests):

- Image validation: valid JPEG accepted; unsupported MIME rejected; >8 MB
  rejected; spoofed extension rejected.
- Magic-byte detection: PNG and JPEG signatures detected; junk returns null.
- Zod schemas: short passwords rejected; valid sign-up accepted; out-of-range
  coordinates rejected; valid sighting accepted; comment requires a target.

**Verified for this milestone:** `npm run build` succeeds (15 routes),
`npm run test` passes (12/12), `npm run typecheck` is clean.

## Manual QA checklist (M0/M1)

### Foundation / navigation
- [ ] `npm run dev` starts with no console errors on the home page.
- [ ] Navbar links (Map, Cases, Report, About) all resolve — no 404s.
- [ ] Footer links resolve.
- [ ] Layout is responsive (mobile link row appears < md breakpoint).

### Auth
- [ ] Sign up creates an account; a `profiles` row appears with `role = 'user'`.
- [ ] Sign in works; navbar shows the display name + role.
- [ ] Sign out returns to home and clears the session.
- [ ] Visiting `/profile` while signed out redirects to sign-in.
- [ ] Visiting `/admin` as a non-admin redirects (to `/profile`).

### RLS — verify per role (Supabase SQL editor "Run as" / app sessions)
- [ ] **Guest/anon**: `select * from sighting_geo_public` returns fuzzed coords;
      `select lat,lng from sightings` returns **no rows** (blocked by RLS).
- [ ] **Registered user**: cannot read precise `sightings` they didn't report;
      can read `cats` and the public geo view; can insert their own sighting.
- [ ] **Volunteer**: after `claimed_by = <volunteer>` on a case, can read the
      precise sighting for that cat; cannot for unclaimed cats.
- [ ] **Org member**: can manage cases where `org_id` matches their profile.
- [ ] **Admin**: can read `audit_logs`; non-admins cannot.
- [ ] A non-admin `update profiles set role='admin'` is rejected by the guard.

### Location privacy
- [ ] `fuzz_coordinate(1.3521)` differs from the raw value and is stable across
      calls.
- [ ] The public view never exposes raw `lat`/`lng` column names.

### Validation
- [ ] Sign-up form rejects a 5-char password client-side.
- [ ] (M2) Uploading a `.gif` or a >8 MB file is rejected.

## How to run the seed and verify data

1. Run migrations `0001`–`0005`, then `supabase/seed.sql`.
2. Confirm: 4 profiles with distinct roles, 1 approved organisation, 7 cats
   across statuses, 6 sightings (3 for the orange tabby), 7 cases, feeding
   schedule + logs, a TNR record, an adoption, comments, a moderation flag,
   notifications, seeded `match_suggestions`, and `audit_logs` rows (some
   auto-created by triggers on the case/tnr/adoption/flag inserts).
