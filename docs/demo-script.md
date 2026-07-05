# PawPin — Demo Script

A ~9-10 minute walkthrough for judges. This reflects the M0-M5 build: the
full reporting-to-adoption pipeline, plus the admin governance layer that
makes the platform safe and reviewable.

## Setup (before recording)

1. Run migrations 0001-0010 and supabase/seed.sql in the Supabase SQL editor.
2. In .env.local, set the Supabase URL + keys and NEXT_PUBLIC_APP_URL.
3. (Recommended) Disable "Confirm email" in Supabase Auth for a smooth sign-in.
4. npm run dev then open http://localhost:3000.

## Scene-by-scene

**0:00 - The pitch (home page)**
- Open the landing page. Read the tagline: "Drop a Pin, Save a Stray."
- Mention the full pipeline: report -> match -> claim -> coordinate ->
  govern, all backed by real Postgres data and RLS.

**0:30 - Quick tour of the existing pipeline**
- Cat #1 profile: persistent profile, claimed case, active feeding schedule.
- /report -> Matching Review modal on an orange tabby near the seeded area.
- /cases: filters, quick badges, claim button.
(Keep this brief - it's the M2-M4 recap; the new material starts next.)

**2:00 - Sign in as admin, tour the dashboard**
- Sign in as admin@pawpin.test / PawPinDemo123.
- Go to /admin. Walk through the stat cards: total users, pending volunteer
  approvals, pending organisations, open moderation flags, active cases,
  closed/archived cases - all real counts from the seeded data.
- Point out "Recent audit logs" and "Recent reports" on the same page, and
  the quick links to each review queue.

**3:00 - Role & approval management**
- Go to /admin/users. Point out `pending_volunteer@pawpin.test` showing
  "Pending" approval status.
- Check the "Approved" box for that row and save. Mention: every change here
  writes an audit log entry with the before/after role and approval values.
- Try to change your OWN role in the dropdown - show it's disabled entirely
  for your own admin row, and explain the server-side RPC would reject it
  even if the UI were bypassed.

**4:15 - Organisation approval**
- Go to /admin/organizations. "Paws & Whiskers Rescue" is pending.
- Approve it with a short note ("Verified contact details"). It moves to
  the "Approved" section immediately.
- Mention: signing in as a member of an unapproved org would show a
  "pending approval" message instead of the org dashboard - the same
  pattern used for pending volunteers.

**5:15 - Moderation flags**
- Go to /admin/flags. Two open flags: one on a comment, one on a cat profile.
- On the comment flag, click "Hide comment". On the cat flag, click "Close
  case". Both actions move to "Recently reviewed" and each writes an audit
  log row.
- Go to the flagged cat's profile as a signed-out or non-admin session and
  show the hidden comment simply isn't there; sign back in as admin and
  show it reappears with a "Hidden" badge and an "Unhide" control.

**6:45 - Case governance**
- On cat #4's profile (medical case), show the case-governance controls:
  close, archive, release claim, reassign. Close the case with a confirm
  prompt, and show the new "Case closed" timeline entry.
- Visit cat #8 (seeded closed) or cat #9 (seeded archived) and show the
  "Reopen case" button appears only because the case is closed/archived -
  and explain that an adopted/released cat's case can't be reopened this
  way on purpose, to avoid contradicting a resolved outcome.
- Try "Reassign..." with a target user ID and show the case_events entry
  and updated "Handled by" field.

**8:00 - Audit log viewer**
- Go to /admin/audit-logs. Show the filterable table: filter by action
  (e.g. "update_user_role") and by entity type (e.g. "organizations").
- Point out it's fully read-only - no edit or delete control exists anywhere
  on the page - and that every row you just generated in this demo is here.

**9:00 - Wrap-up**
- Mention: every admin action you just saw is enforced by a SECURITY
  DEFINER Postgres function that re-checks the caller's admin status (or,
  for case governance, admin-or-case-access) independently of the UI - a
  crafted request calling these functions directly gets the exact same
  rejection a non-admin would see clicking around the UI.
- Note what's left for M6/M7: rate limiting, CSP headers, guest reporting,
  EXIF stripping, and UI polish (e.g. a real user picker for reassignment
  instead of a raw ID field) - all explicitly documented, not hidden.

## Talking points to land the rubric

- Technical execution: 10 migrations, RLS on every table, 20+ SECURITY
  DEFINER RPCs across M3-M5 all following the same self-authorizing,
  atomic-write pattern, 97 passing unit tests, and a real admin console
  built from live queries, not mocked data.
- Innovation: persistent profiles and explainable matching carried all the
  way through to a governed, auditable rescue platform.
- Theme: the complete lifecycle of a rescued stray, now including the
  moderation and governance layer that any real community platform needs.
- Security: layered RLS + RPC authorization, a self-demotion guard, an
  admin-note-preserving rejection flow (never silently deleting), hidden
  comments enforced at the query layer, and a tamper-proof audit trail
  written by a helper function with no client-facing grant of its own.
- UX/UI: honest role gating everywhere (a disabled dropdown, not a
  save-time surprise), confirmation prompts on every destructive action,
  and a filterable audit log that's actually useful, not just a raw dump.
- Documentation: this repo's docs and spec, kept in sync with what's
  actually shipped at every milestone, including this one.
