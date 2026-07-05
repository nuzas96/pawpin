# PawPin — Submission Checklist

Self-audit mapped to the #hackthekitty rubric. Status reflects the M0-M3
build.

## Rubric coverage

### Technical Execution (25%)
- [x] Real full-stack app (Next.js App Router + Supabase Postgres), not static.
- [x] Data persists in Supabase; schema via ordered SQL migrations (0001-0008).
- [x] RLS enabled on every table with helper functions.
- [x] Real report -> Storage upload -> matching -> persistent profile loop.
- [x] Deterministic matching engine with 11 dedicated unit tests plus 3
      wording/privacy tests.
- [x] Interactive React Leaflet map with filters, loading/empty/error states.
- [x] `npm run build` passes (15 routes); `npm run typecheck` clean.
- [x] Unit tests pass (`npm run test`, 46/46).
- [ ] Dashboards, feeding/TNR/adoption workflows (M4-M5).

### Innovation & Creativity (20%)
- [x] Persistent cat profiles are now real: matching links repeat sightings
      into one continuous history instead of isolated reports.
- [x] Explainable heuristic matching - similarity score out of 100, confidence
      band, per-signal reasons, always requiring human confirmation.
- [x] Deterministic engine works with zero external dependencies; optional AI
      adapter skeleton exists but is a strict no-op in this milestone.

### Theme Relevance (15%)
- [x] End-to-end loop implemented: report a stray -> matching review ->
      link to an existing cat or create a new profile -> visible on the live
      map, case board, and upgraded cat profile.
- [x] Reduces duplicate reports, which is the stated real-world problem.
- [x] Privacy-first design protects vulnerable animals (fuzzed public map,
      restricted precise coordinates, even during matching).

### Documentation (10%)
- [x] `README.md` (overview, setup, Supabase setup, env vars, how
      report/upload/map/privacy/matching work).
- [x] `docs/architecture.md` - full matching weights table, engine design,
      privacy boundary, decision actions.
- [x] `docs/security-report.md`, `docs/testing.md`, `docs/demo-script.md`,
      this checklist - all updated for M3.
- [x] `.kiro/specs/pawpin/spec.md`.
- [x] All documentation in English.

### Security (15%)
- [x] Supabase Auth + RLS + role-based access control.
- [x] Location privacy: SQL fuzzing + two public views; precise GPS
      restricted, including a documented matching-specific privacy boundary.
- [x] Zod validation + image file validation, enforced server-side.
- [x] Match decision actions re-validate input and rely on RLS ownership
      checks rather than trusting client-supplied cat/sighting IDs blindly.
- [x] Random, per-user-scoped storage paths; original filenames discarded.
- [x] Plain-text user content (no raw HTML rendering).
- [x] Audit logging (insert-only, admin-read).
- [x] Service-role key server-only; `.env.local` git-ignored; no real secrets.
- [x] Next.js pinned to a patched release.
- [x] Honest, documented gaps: EXIF/GPS stripping, guest reporting, AI adapter
      is a no-op skeleton.
- [ ] Rate limiting / CSP headers / CAPTCHA (M6).

### UX/UI (15%)
- [x] Responsive shell, warm brand theme, accessible focus states.
- [x] Mobile-first, section-based report form with photo preview, GPS capture
      + manual fallback, chip-style urgency/condition pickers.
- [x] Polished Matching Review modal: candidate cards with photo, score,
      confidence badge, reasons list, and clear link/create actions.
- [x] Real loading, matching, success, and error states on the report flow.
- [x] Interactive map with filters and loading/empty/error states.
- [x] Upgraded cat profile: stats bar, linked photo gallery, timeline.
- [x] Case board and cat profile pages with honest disabled controls.
- [ ] Volunteer/org/admin dashboards (M5).

## Pre-submission
- [ ] `.env.local` created (not committed); `.env.example` present.
- [ ] Migrations (0001-0008) + seed run against a fresh Supabase project.
- [ ] Demo accounts verified (see README).
- [ ] `npm install && npm run build` verified on a clean clone.
- [ ] End-to-end manual test: sign in -> submit a report near the seeded
      orange tabby -> confirm the Matching Review appears -> link it -> see
      the updated "Seen N times" count on the cat profile.
- [ ] End-to-end manual test: submit a report with clearly different traits
      -> confirm "No likely match found" -> create a new profile.
- [ ] Demo video recorded following `docs/demo-script.md`.
