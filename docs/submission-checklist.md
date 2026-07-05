# PawPin — Submission Checklist

Self-audit mapped to the #hackthekitty rubric. Status reflects the M0-M4
build.

## Rubric coverage

### Technical Execution (25%)
- [x] Real full-stack app (Next.js App Router + Supabase Postgres), not static.
- [x] Data persists in Supabase; schema via ordered SQL migrations (0001-0009).
- [x] RLS enabled on every table with helper functions.
- [x] Six SECURITY DEFINER coordination RPCs (claim, case update, feeding
      schedule/log, TNR, adoption) with atomic writes and self-authorization,
      following the pattern established after the M3 audit.
- [x] Full loop implemented: report -> matching review -> persistent profile
      -> claim -> feeding/TNR/adoption -> community engagement.
- [x] `npm run build` passes (15 routes); `npm run typecheck` clean.
- [x] Unit tests pass (`npm run test`, 73/73).
- [ ] Admin moderation, org approval, audit log viewer (M5).

### Innovation & Creativity (20%)
- [x] Persistent cat profiles carried through to a complete rescue workflow,
      not just a matching demo.
- [x] Explainable heuristic matching (M3) feeding directly into real
      coordination outcomes.
- [x] Status-transition safety (TNR/adoption never regress an already
      adopted/closed cat) is enforced server-side, not just in the UI.

### Theme Relevance (15%)
- [x] End-to-end lifecycle: report -> match -> claim -> feed/TNR -> adopt,
      with the community kept informed via comments/follows/notifications.
- [x] Privacy-first design maintained throughout (adopter contact never
      public; precise coordinates never exposed even during coordination).

### Documentation (10%)
- [x] `README.md` — how-to sections for volunteer coordination, feeding, TNR,
      adoption, and community engagement, plus updated milestone status.
- [x] `docs/architecture.md` — new §3e (coordination RPCs), updated schema
      and key-decisions sections.
- [x] `docs/security-report.md` — new §4b (coordination RPC security),
      updated threat model and RLS highlights.
- [x] `docs/testing.md`, `docs/demo-script.md` — updated with M4 flows.
- [x] `.kiro/specs/pawpin/spec.md` — updated milestones/acceptance criteria.
- [x] All documentation in English.

### Security (15%)
- [x] Supabase Auth + RLS + role-based access control.
- [x] Location privacy maintained through coordination features (no new
      coordinate exposure paths introduced).
- [x] Every coordination write independently re-checks authorization inside
      its RPC — never trusts a client-supplied role or ownership claim.
- [x] Double-claim prevention with an explicit, auditable admin/org override
      (not a silent takeover).
- [x] Adopter contact is write-only from the UI's perspective and
      RLS-restricted to admin/authorised carers for reads.
- [x] Plain-text comments (no raw HTML rendering), documented explicitly as
      a schema-vs-rendering split responsibility.
- [x] Honest, documented gaps: EXIF/GPS stripping, guest reporting, AI
      adapter no-op, admin moderation/org approval (M5), rate limiting (M6).
- [ ] Rate limiting / CSP headers / CAPTCHA (M6).

### UX/UI (15%)
- [x] Real claim button with three states (eligible/ineligible/already
      mine) — no fake or hidden controls; ineligible users see why.
- [x] Feeding/TNR/adoption forms gated to authorised carers only.
- [x] Case board with status/urgency/claimed filters and quick badges.
- [x] Volunteer and org dashboards built from real queries.
- [x] Notification bell with unread badge and mark-all-read on open.
- [x] Follow/bookmark buttons reflect persisted state, not just client state.
- [ ] Admin dashboard remains a placeholder (M5).

## Pre-submission
- [ ] `.env.local` created (not committed); `.env.example` present.
- [ ] Migrations (0001-0009) + seed run against a fresh Supabase project.
- [ ] Demo accounts verified (see README).
- [ ] `npm install && npm run build` verified on a clean clone.
- [ ] End-to-end manual test: claim an unclaimed case as the volunteer
      account, create a feeding schedule, log a feeding, update TNR status,
      update adoption status, and confirm each appears in the timeline.
- [ ] End-to-end manual test: as a plain user, confirm the claim button is
      replaced with an explanatory message rather than a broken control.
- [ ] End-to-end manual test: post a comment, follow, and bookmark a cat;
      confirm state persists after reload.
- [ ] Demo video recorded following `docs/demo-script.md`.
