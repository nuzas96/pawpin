# PawPin — Testing

## Automated tests

```bash
npm run test        # Vitest unit tests
npm run typecheck   # TypeScript type checking (no emit)
npm run build       # production build (also type-checks + lints)
```

Current unit coverage (73 tests across 6 files):

**`src/lib/matching/engine.test.ts` (11 tests)** — scoring behaviour (identical/
different traits, distance/recency sensitivity, unknown-field neutrality,
distinguishing-mark boost, ear-tip cap, threshold filtering, max-5 cap,
required disclaimer/reasons). Unchanged since M3.

**`src/lib/matching/wordingAndPrivacy.test.ts` (3 tests)** — forbidden-phrase
scan, exact disclaimer string, `PublicMatchCandidate` has no coordinate keys.
Unchanged since M3.

**`src/lib/geo/location.test.ts` (6 tests)** and
**`src/lib/map/publicMapPrivacy.test.ts` (4 tests)** — unchanged since M2.

**`src/lib/validation/validation.test.ts` (39 tests)** — image/sign-up/
sighting/comment/matching-decision schemas (M2/M3), plus M4 additions:
- `claimCaseSchema` — valid/invalid case UUID.
- `caseUpdateSchema` — empty note rejected, invalid category rejected, valid
  update accepted.
- `feedingScheduleSchema` — empty description rejected, frequency defaults to
  `daily`, invalid frequency rejected.
- `feedingLogSchema` — accepts the new `foodType` field.
- `tnrRecordSchema` — accepts all 7 M4 status values
  (`not_started`/`trap_planned`/`trapped`/`surgery_scheduled`/`neutered`/
  `ear_tipped`/`released`), rejects an invalid status.
- `adoptionSchema` — accepts all 6 M4 status values
  (`not_available`/`intake`/`available`/`application_received`/`matched`/
  `adopted`), rejects a legacy M0 status (`inquiry`), accepts an optional
  adopter contact.
- `followCatSchema` / `bookmarkCatSchema` — valid/invalid cat UUID.
- Documents the plain-text contract for `commentSchema`: the schema itself
  does not sanitise HTML — safety comes from React's default text escaping
  at render time (`CommentList` never uses `dangerouslySetInnerHTML`), and
  this test makes that division of responsibility explicit rather than
  assuming it.

**`src/lib/auth/roleGating.test.ts` (10 tests, new in M4)**
- `hasAtLeast` mirrors the `claim_case` RPC's role check: a plain `user` and
  a guest (`null`/`undefined`/`"guest"`) are never eligible; `volunteer`,
  `org`, and `admin` all are.
- `isAdmin`/`isVolunteer`/`isOrg` predicate correctness.
- Notification payload shape contract: valid shapes for `case_claimed`,
  `status_change`, and `new_sighting` payloads are accepted; a payload
  missing the required `message` field is rejected. This guards the
  `NotificationsBell` component's payload-reading code against a silent
  shape mismatch with `notify_followers()`.

**Verified for this milestone:** `npm run build` succeeds (15 routes),
`npm run test` passes (73/73), `npm run lint` is clean, `npm run typecheck`
is clean.

## Manual QA checklist (M4 additions)

### Claim flow
- [ ] Signed in as `user@pawpin.test` (role `user`): visiting an unclaimed
      case's cat profile shows an explanatory message, not a claim button.
- [ ] Signed in as `volunteer@pawpin.test`: an unclaimed case shows "I can
      help — claim this case"; clicking it claims the case, refreshes the
      page, and now shows "✓ You're handling this case".
- [ ] A `case_events` row "Case claimed by volunteer" appears in the case
      timeline immediately after claiming.
- [ ] **Double-claim prevention:** attempting to claim an already-claimed
      case as a *different* volunteer (not admin, not the same org) is
      rejected with "This case has already been claimed by another
      volunteer."
- [ ] **Org override:** a signed-in `org` user whose `org_id` matches the
      case's `org_id` CAN re-claim/take over an already-claimed case.
- [ ] Admin can claim/reassign any case regardless of current claim.

### Feeding workflow
- [ ] As the claiming volunteer, create a feeding schedule (frequency,
      description, optional location + next feeding time) from the cat
      profile — it appears under "Active schedule" immediately.
- [ ] Log a feeding (food type + notes) — it appears in "Recent feeding
      history" and in the combined timeline ("Feeding logged").
- [ ] A non-carer (e.g. a different registered user) does not see the
      feeding schedule/log forms on the cat profile.

### TNR workflow
- [ ] Update TNR status through the sequence
      not_started → trap_planned → trapped → surgery_scheduled → neutered →
      ear_tipped → released; each update appears in the timeline as "Tnr
      update".
- [ ] Setting status to `released` promotes the cat's overall status to
      "Released" — verify on the cat profile's status badge.
- [ ] **Regression guard:** for a cat already `adopted` (e.g. seeded cat #6),
      confirm that setting a (hypothetical) TNR record's status to `released`
      does NOT change the cat's status away from `adopted` — check
      `update_tnr_record`'s guard directly in SQL if needed.

### Adoption workflow
- [ ] Update adoption status through
      not_available → intake → available → application_received → matched →
      adopted; each update appears in the timeline as "Adoption update".
- [ ] Setting status to `adopted` promotes the cat's status to "Adopted" and
      closes the case (`closed_at` set) — verify via the case's status badge.
- [ ] Enter an adopter contact value, submit, then reload the page: the form
      never displays the previously-entered value back (write-only by
      design — see `docs/security-report.md` §4b).
- [ ] A guest/non-carer visiting the cat profile sees only the adoption
      **status** badge, never a contact field or form.

### Comments / follow / bookmark
- [ ] Signed-in users can post a comment on a cat profile; it appears
      immediately with the author's display name and timestamp.
- [ ] Posting `<script>alert(1)</script>` as a comment renders it as literal
      text on the page (view page source / inspect — no script executes).
- [ ] Follow/unfollow and bookmark/unbookmark toggle correctly and persist
      across a page reload (state is read from `follows`/`bookmarks` on
      load, not just client state).
- [ ] A guest sees a "Sign in to comment" prompt instead of a broken form.

### Notifications
- [ ] After a followed cat's case is claimed, TNR/adoption status changes, or
      a case update is posted, the follower's navbar bell shows an unread
      badge on next page load.
- [ ] Opening the bell dropdown marks all shown notifications as read
      (badge clears); each entry links to the relevant cat profile.
- [ ] The self-notification exclusion works: claiming your own previously
      self-reported case does not notify yourself (only *other* followers).

### Dashboards
- [ ] `/dashboard/volunteer` (as `volunteer@pawpin.test`) shows the seeded
      claimed case (orange tabby) with its feeding/TNR badges, plus the
      unclaimed critical kitten case under "Open urgent cases nearby".
- [ ] `/dashboard/org` (as `org@pawpin.test`) shows stat cards, the unclaimed
      kitten case, and non-empty TNR/adoption pipeline breakdowns.
- [ ] A plain `user` visiting either dashboard URL directly is redirected
      (role guard).

### RLS — verify per role (Supabase SQL editor "Run as" / app sessions)
- [ ] A non-admin, non-volunteer, non-org `update profiles set role='admin'`
      is rejected by the guard (unchanged from M1, still verify).
- [ ] `select adopter_contact from adoptions` as a plain `user` (not a carer
      on that cat) returns no rows.
- [ ] Calling `select * from claim_case('<some-case-id>')` directly as a
      plain `user` role raises "Only volunteers, organisations, or admins
      can claim a case".

## How to run the seed and verify data

1. Run migrations `0001`–`0009`, then `supabase/seed.sql`.
2. Confirm: the orange tabby's case (#1) is claimed by the demo volunteer
   with an active feeding schedule + 2 logs; the calico's case (#2) has an
   in-progress TNR record (`neutered`, ear-tipped, recovering); the black
   kitten's case (#5) is unclaimed and critical priority; three adoption
   records exist across `available`/`matched`/`adopted`; comments, follows,
   bookmarks, and four notification examples (covering `case_claimed`,
   `tnr_update`, `adoption_update`, `new_sighting`) are present.
3. Sign in as `volunteer@pawpin.test` and visit `/dashboard/volunteer` to see
   the claimed case and its tasks; sign in as `user@pawpin.test` to see the
   notification bell populated from the seeded follows.
