# PawPin — Submission Checklist

Self-audit mapped to the #hackthekitty rubric. Status reflects the **M0/M1/M2**
build.

## Rubric coverage

### Technical Execution (25%)
- [x] Real full-stack app (Next.js App Router + Supabase Postgres), not static.
- [x] Data persists in Supabase; schema via ordered SQL migrations (0001–0006).
- [x] RLS enabled on every table with helper functions.
- [x] Real report → Storage upload → map end-to-end loop (`createSighting`
      server action, `uploadCatPhoto` helper, `cats_map_public` view).
- [x] Interactive React Leaflet map with filters, loading/empty/error states.
- [x] `npm run build` passes (15 routes); `npm run typecheck` clean.
- [x] Unit tests pass (`npm run test`, 26/26).
- [ ] Matching engine, dashboards, feeding/TNR/adoption workflows (M3–M5).

### Innovation & Creativity (20%)
- [x] Persistent cat profiles (one history across many sightings) modelled
      and now actually created by the report flow.
- [x] Explainable matching output shape (score + reasons + human confirmation),
      seeded now; engine ships M3.
- [x] Optional AI enhancer designed to be strictly optional.

### Theme Relevance (15%)
- [x] End-to-end loop implemented: report a stray → photo/location stored →
      cat profile + case created → visible on the live map and case board.
- [x] Privacy-first design protects vulnerable animals (fuzzed public map,
      restricted precise coordinates).

### Documentation (10%)
- [x] `README.md` (overview, setup, Supabase setup, env vars, how report/
      upload/map/privacy work).
- [x] `docs/architecture.md`, `docs/security-report.md`, `docs/testing.md`,
      `docs/demo-script.md`, this checklist — all updated for M2.
- [x] `.kiro/specs/pawpin/spec.md`.
- [x] All documentation in English.

### Security (15%)
- [x] Supabase Auth + RLS + role-based access control.
- [x] Location privacy: SQL fuzzing + two public views; precise GPS restricted.
- [x] Zod validation + image file validation (MIME/size/magic bytes), enforced
      server-side in the report server action.
- [x] Random, per-user-scoped storage paths; original filenames discarded.
- [x] Plain-text user content (no raw HTML rendering).
- [x] Audit logging (insert-only, admin-read).
- [x] Service-role key server-only; `.env.local` git-ignored; no real secrets.
- [x] Next.js pinned to a patched release.
- [x] Honest, documented gap: EXIF/GPS metadata stripping not yet implemented
      (see `docs/security-report.md` §4).
- [x] Honest, documented scope decision: reporting requires authentication
      for M2; guest reporting deferred to M3/M4.
- [ ] Rate limiting / CSP headers / CAPTCHA (M6).

### UX/UI (15%)
- [x] Responsive shell, warm brand theme, accessible focus states.
- [x] Mobile-first, section-based report form with photo preview, GPS capture
      + manual fallback, chip-style urgency/condition pickers.
- [x] Real loading, success, and error states on the report flow.
- [x] Interactive map with filters and loading/empty/error states.
- [x] Case board and cat profile pages with honest disabled controls (no fake
      interactivity).
- [ ] Volunteer/org/admin dashboards (M5).

## Pre-submission
- [ ] `.env.local` created (not committed); `.env.example` present.
- [ ] Migrations (0001–0006) + seed run against a fresh Supabase project.
- [ ] Demo accounts verified (see README).
- [ ] `npm install && npm run build` verified on a clean clone.
- [ ] End-to-end manual test: sign in → submit a report → see it on `/map`
      and `/cases` → open its `/cats/[catId]` profile.
- [ ] Demo video recorded following `docs/demo-script.md`.
