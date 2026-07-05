# PawPin — Submission Checklist

Self-audit mapped to the #hackthekitty rubric. Status reflects the M0-M5
build.

## Rubric coverage

### Technical Execution (25%)
- [x] Real full-stack app (Next.js App Router + Supabase Postgres), not static.
- [x] Data persists in Supabase; schema via ordered SQL migrations (0001-0010).
- [x] RLS enabled on every table with helper functions.
- [x] Admin governance layer: 11 SECURITY DEFINER RPCs (role update, org
      approve/reject, flag review, comment hide/unhide, 5 case-governance
      actions) each self-authorizing and writing an explicit audit log row.
- [x] Full loop implemented: report -> match -> claim -> coordinate ->
      govern/moderate -> audit, with community engagement throughout.
- [x] `npm run build` passes (19 routes); `npm run typecheck` clean.
- [x] Unit tests pass (`npm run test`, 97/97).
- [ ] Rate limiting, CSP headers, guest reporting, EXIF stripping (M6).

### Innovation & Creativity (20%)
- [x] Persistent cat profiles carried through report -> match -> coordinate
      -> govern — a complete, coherent lifecycle rather than disconnected
      features.
- [x] Self-authorizing RPC pattern applied consistently from M3 through M5,
      discovered and corrected via a real audit rather than assumed correct.
- [x] Audit trail designed to be genuinely useful (purpose-built diffs, not
      raw row dumps) and genuinely tamper-resistant (no client insert path).

### Theme Relevance (15%)
- [x] End-to-end lifecycle: report -> match -> claim -> feed/TNR/adopt ->
      moderate/govern, mirroring how a real rescue coordination platform
      needs to operate responsibly at scale.
- [x] Privacy-first design maintained throughout every new feature.

### Documentation (10%)
- [x] `README.md` — new "How admin governance works" section, updated demo
      accounts table, milestone status, and known limitations.
- [x] `docs/architecture.md` — new §3f (admin governance design).
- [x] `docs/security-report.md` — new §4c (admin governance RPC security),
      expanded threat model.
- [x] `docs/testing.md`, `docs/demo-script.md` — updated with M5 flows.
- [x] `.kiro/specs/pawpin/spec.md` — updated milestones/acceptance criteria.
- [x] All documentation in English.

### Security (15%)
- [x] Supabase Auth + RLS + role-based access control, now including
      approval-gated volunteer/org access.
- [x] Self-demotion guard (server RPC + disabled UI control) prevents an
      admin from locking themselves out.
- [x] Every admin RPC independently re-checks `is_admin()` (or
      admin-or-case-access for governance) — never trusts the UI.
- [x] Rejection preserves data (orgs are never deleted, only unapproved)
      for auditability and correction.
- [x] Hidden comments enforced at the RLS/query layer, not just hidden in
      the UI; comment text is never modified by moderation.
- [x] Audit log writes are only reachable through RPCs — no client insert
      policy exists on `audit_logs` at all.
- [x] Honest, documented gaps: rate limiting, CSP, guest reporting, EXIF
      stripping, reassignment UI polish (all M6/M7).
- [ ] Rate limiting / CSP headers / CAPTCHA (M6).

### UX/UI (15%)
- [x] Real admin dashboard, users/orgs/flags/audit-log pages — tables,
      badges, confirmation prompts on destructive actions, loading/empty/
      error states, no fake buttons.
- [x] Role selector disabled (not just validated) for self-demotion.
- [x] Case governance buttons are status-aware (e.g. "Reopen" only appears
      on closed/archived cases).
- [x] Flag/report control accessible from cat profiles and comments.
- [x] Filterable, read-only audit log table.
- [ ] Reassignment uses a raw user ID rather than a searchable picker (M7).

## Pre-submission
- [ ] `.env.local` created (not committed); `.env.example` present.
- [ ] Migrations (0001-0010) + seed run against a fresh Supabase project.
- [ ] Demo accounts verified (see README), including the pending volunteer.
- [ ] `npm install && npm run build` verified on a clean clone.
- [ ] End-to-end manual test: approve the pending volunteer and organisation,
      review both open moderation flags, hide/unhide a comment, and
      close/reopen/archive/reassign a case — confirm each writes an audit
      log row visible in `/admin/audit-logs`.
- [ ] End-to-end manual test: confirm a non-admin cannot reach any `/admin/*`
      route and cannot see a hidden comment.
- [ ] Demo video recorded following `docs/demo-script.md`.
