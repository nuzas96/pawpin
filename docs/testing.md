# PawPin — Testing

## Automated tests

```bash
npm run test        # Vitest unit tests
npm run typecheck   # TypeScript type checking (no emit)
npm run build       # production build (also type-checks + lints)
```

Current unit coverage (97 tests across 6 files):

**`src/lib/matching/engine.test.ts` (11)** and
**`src/lib/matching/wordingAndPrivacy.test.ts` (3)** — matching engine
scoring and wording/privacy contracts, unchanged since M3.

**`src/lib/geo/location.test.ts` (6)** and
**`src/lib/map/publicMapPrivacy.test.ts` (4)** — unchanged since M2.

**`src/lib/validation/validation.test.ts` (52 tests)** — image/sign-up/
sighting/comment/matching/coordination schemas (M2–M4), plus M5 additions:
- `updateUserRoleSchema` — invalid role rejected, valid update accepted,
  `isApproved` must be boolean.
- `approveOrganizationSchema` / `rejectOrganizationSchema` — valid/invalid
  org UUID, optional note.
- `reviewModerationFlagSchema` — invalid action rejected, all four valid
  actions (`dismiss`/`resolve`/`hide_comment`/`close_case`) accepted.
- `hideCommentSchema` / `unhideCommentSchema` — valid/invalid comment UUID.
- `closeCaseSchema` / `reopenCaseSchema` / `archiveCaseSchema` /
  `releaseClaimSchema` — valid/invalid case UUID, optional note.
- `reassignCaseSchema` — requires both `caseId` and `newClaimedBy` as valid
  UUIDs.

**`src/lib/auth/roleGating.test.ts` (21 tests, extended in M5)**
- M4 claim-eligibility tests (`hasAtLeast`, role predicates) — unchanged.
- **Admin action gating (new)**: `isAdmin` correctly classifies every role
  (including `null`/`undefined`/`"guest"`) as ineligible for admin-only
  tooling except `"admin"` itself. This mirrors the `is_admin()` check every
  M5 RPC performs server-side.
- **Hidden comment visibility contract (new, 4 tests)**: a guest, and a
  normal user who is not the comment's author, cannot see a hidden comment;
  the comment's own author can still see their own hidden comment; an admin
  can see any hidden comment. This is the same predicate the cat profile
  page uses to decide whether to include `is_hidden` rows in its query.
- **Audit log payload shape contract (new, 5 tests)**: valid shapes for a
  role-update, org-approval, and empty-diff (e.g. `unhide_comment`) audit
  entry are accepted; an entry with an array `diff` or a missing `action`
  field is rejected. Guards `AuditLogTable`'s assumption that `diff` is
  always a plain object it can safely `JSON.stringify`.

**Verified for this milestone:** `npm run build` succeeds (19 routes),
`npm run test` passes (97/97), `npm run lint` is clean, `npm run typecheck`
is clean.

## Manual QA checklist (M5 additions)

### Admin dashboard access control
- [ ] Signed out or signed in as `user@pawpin.test`: visiting `/admin` (or
      any `/admin/*` sub-page) redirects away (role guard) — no admin
      content is ever rendered to a non-admin.
- [ ] Signed in as `admin@pawpin.test`: `/admin` shows real counts (total
      users, pending volunteer/org approvals, open flags, active/closed
      cases) matching the seeded data, plus recent audit logs and recent
      reports with working quick links.

### Role & approval management
- [ ] `/admin/users` lists all profiles with role, approval status, and
      organisation name (where applicable).
- [ ] Changing `pending_volunteer@pawpin.test`'s "Approved" checkbox to
      checked and saving immediately reflects on their next
      `/dashboard/volunteer` visit (pending-approval message disappears).
- [ ] As `admin@pawpin.test`, the role `<select>` for your **own** row is
      disabled — you cannot even attempt to change your own role away from
      admin via the UI.
- [ ] Every role/approval change writes a new row to `/admin/audit-logs`
      with `action = 'update_user_role'` and a `diff` showing before/after.

### Organisation approval
- [ ] `/admin/organizations` shows "Paws & Whiskers Rescue" under "Pending
      approval" and "Alley Cat Rescue" under "Approved".
- [ ] Approving the pending org (optionally with a note) moves it to the
      "Approved" section and writes an `approve_organization` audit log row.
- [ ] Signing in as an `org`-role user linked to an unapproved organisation
      shows the "pending admin approval" message on `/dashboard/org` instead
      of the dashboard content.
- [ ] Rejecting an organisation (with a confirm prompt) keeps the row
      visible (not deleted) with `is_approved = false` and the admin note
      stored.

### Moderation flags
- [ ] `/admin/flags` shows the two seeded open flags (one `comment`-type on
      the hidden-comment example, one `cat`-type on cat #4).
- [ ] The comment-type flag's card offers a "Hide comment" action; the
      cat-type flag's card offers a "Close case" action; both offer
      "Dismiss" and "Mark resolved".
- [ ] Taking any action moves the flag out of "Open flags" and into
      "Recently reviewed", and writes a `review_moderation_flag` audit log row.
- [ ] From a cat profile, a signed-in non-admin can flag the cat profile or
      a comment via the 🚩 report control; the new flag appears in
      `/admin/flags`.

### Comment hide/unhide
- [ ] Signed in as `user@pawpin.test`, visit cat #2's profile — the seeded
      hidden comment ("Buy cheap supplements...") does **not** appear at all.
- [ ] Signed in as `admin@pawpin.test`, the same comment appears with a
      "Hidden" badge and an "Unhide" control.
- [ ] Clicking "Unhide" makes the comment visible to normal users again on
      the next load; clicking "Hide" on any comment removes it from normal
      users' view immediately.
- [ ] Comment text is identical before/after hiding — only visibility changes.

### Case governance
- [ ] On cat #4's profile (medical case), an authorised carer or admin sees
      "Close case", "Archive case", and (if applicable) "Release my claim"
      buttons, each with a confirmation prompt.
- [ ] Closing or archiving a case appends the corresponding `case_events`
      row (`case_closed`/`case_archived`) and updates the status badge.
- [ ] On cat #8 (seeded `closed`) or cat #9 (seeded `archived`), a "Reopen
      case" button appears; reopening sets status back to `active` and
      appends `case_reopened`.
- [ ] Attempting to reopen a case that is `adopted`/`released` is not
      offered by the UI (the button only appears for `closed`/`archived`),
      and the `reopen_case` RPC itself rejects such an attempt if called
      directly.
- [ ] "Reassign…" (admin or org member of the case's org) accepts a target
      user ID and, on success, updates `claimed_by` and appends
      `case_reassigned`; providing a non-volunteer/org/admin user ID is
      rejected with a clear error.

### Audit log viewer
- [ ] `/admin/audit-logs` shows at least the 6 explicit seeded rows plus any
      trigger-generated rows from earlier seed inserts.
- [ ] The "Action" and "Entity type" filters narrow the table correctly and
      can be combined.
- [ ] The table is read-only — no edit/delete controls exist anywhere on
      the page.
- [ ] Non-admins cannot reach `/admin/audit-logs` (role guard) and cannot
      `select * from audit_logs` directly (RLS `audit_select` policy).

### RLS / RPC direct-call checks (Supabase SQL editor)
- [ ] Calling `select update_user_role(...)` as a non-admin raises "Only an
      admin can change user roles".
- [ ] Calling `select claim_case(...)` as the seeded pending volunteer
      raises "Your account is pending admin approval and cannot claim cases
      yet".
- [ ] Calling `select reopen_case(...)` on an `adopted` case raises "Only a
      closed or archived case can be reopened".

## How to run the seed and verify data

1. Run migrations `0001`–`0010`, then `supabase/seed.sql`.
2. Confirm 5 profiles (one pending volunteer, `is_approved = false`), 2
   organisations (one pending), 9 cats, a hidden comment, 2 open + 1
   resolved moderation flags, a closed case (#8) and an archived case (#9),
   and at least 6 explicit `audit_logs` rows covering
   `update_user_role`/`approve_organization`/`close_case`/`archive_case`/
   `review_moderation_flag`.
3. Sign in as `admin@pawpin.test` and walk through `/admin`, `/admin/users`,
   `/admin/organizations`, `/admin/flags`, and `/admin/audit-logs` in order.
