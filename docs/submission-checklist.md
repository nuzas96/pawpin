# PawPin — Submission Checklist

Self-audit mapped to the #hackthekitty rubric. Status reflects the **M0/M1**
foundation build.

## Rubric coverage

### Technical Execution (25%)
- [x] Real full-stack app (Next.js App Router + Supabase Postgres), not static.
- [x] Data persists in Supabase; schema via ordered SQL migrations.
- [x] RLS enabled on every table with helper functions.
- [x] `npm run build` passes (15 routes); `npm run typecheck` clean.
- [x] Unit tests pass (`npm run test`, 12/12).
- [ ] Interactive report/map/matching/dashboards (M2–M5).

### Innovation & Creativity (20%)
- [x] Persistent cat profiles (one history across many sightings) modelled.
- [x] Explainable matching output shape (score + reasons + human confirmation),
      seeded now; engine ships M3.
- [x] Optional AI enhancer designed to be strictly optional.

### Theme Relevance (15%)
- [x] Entire lifecycle modelled: report → match → coordinate → TNR/medical →
      adoption/release.
- [x] Privacy-first design protects vulnerable animals.

### Documentation (10%)
- [x] `README.md` (overview, setup, Supabase setup, env vars).
- [x] `docs/architecture.md`, `docs/security-report.md`, `docs/testing.md`,
      `docs/demo-script.md`, this checklist.
- [x] `.kiro/specs/pawpin/spec.md`.
- [x] All documentation in English.

### Security (15%)
- [x] Supabase Auth + RLS + role-based access control.
- [x] Location privacy: SQL fuzzing + public view; precise GPS restricted.
- [x] Zod validation + image file validation (MIME/size/magic bytes).
- [x] Plain-text user content (no raw HTML rendering).
- [x] Audit logging (insert-only, admin-read).
- [x] Service-role key server-only; `.env.local` git-ignored; no real secrets.
- [x] Next.js pinned to a patched release.
- [ ] Rate limiting / CSP headers (M6).

### UX/UI (15%)
- [x] Responsive shell, warm brand theme, accessible focus states.
- [x] Role-aware navbar; honest placeholders (no fake buttons).
- [ ] Interactive map + report stepper (M2).

## Pre-submission
- [ ] `.env.local` created (not committed); `.env.example` present.
- [ ] Migrations + seed run against a fresh Supabase project.
- [ ] Demo accounts verified (see README).
- [ ] `npm install && npm run build` verified on a clean clone.
- [ ] Demo video recorded following `docs/demo-script.md`.
