# PawPin — Demo Script

A ~7-8 minute walkthrough for judges. This reflects the M0-M4 build:
foundation, data/security backbone, the report-to-map loop, the matching
engine and persistent cat profiles, and now full volunteer/rescue
coordination (claim, feeding, TNR, adoption) plus community engagement.

## Setup (before recording)

1. Run migrations 0001-0009 and supabase/seed.sql in the Supabase SQL editor.
2. In .env.local, set the Supabase URL + keys and NEXT_PUBLIC_APP_URL.
3. (Recommended) Disable "Confirm email" in Supabase Auth for a smooth sign-in.
4. npm run dev then open http://localhost:3000.
5. Have your browser location permission ready to allow (or plan to use the
   manual lat/lng fallback on stage).

## Scene-by-scene

**0:00 - The pitch (home page)**
- Open the landing page. Read the tagline: "Drop a Pin, Save a Stray."
- Point out the three differentiators: persistent cat profiles, privacy-first
  map, explainable matching - now backed by a full coordination workflow.

**0:30 - The persistent profile, seeded**
- Go to the orange tabby's cat profile (/cats/c0000000-0000-0000-0000-000000000001).
  Point out the stats bar ("Seen 3 times"), the case coordination card
  showing it's already claimed by the demo volunteer, the active feeding
  schedule, and the combined timeline mixing sightings, claims, and feeding logs.

**1:15 - Report a stray that's a likely match**
- Sign in as user@pawpin.test / PawPinDemo123.
- Go to /report. Fill in an orange tabby near lat 1.3521, lng 103.8198.
  Submit, see the Matching Review modal, and link it to the existing cat.
- Land on the cat profile - stats bar now says "Seen 4 times".

**2:30 - Claim a case as a volunteer (the M4 centerpiece)**
- Sign out, sign in as volunteer@pawpin.test / PawPinDemo123.
- Go to /cases. Point out the filters (status/urgency/claimed) and the quick
  badges (Unclaimed, Feeding active, TNR active, Adoption active).
- Find the unclaimed critical black-kitten case. Click through to its cat
  profile and click "I can help - claim this case".
- Show the immediate result: the case coordination card now shows "You're
  handling this case", and a new "Case claimed by volunteer" entry appears
  in the timeline.
- Try claiming an already-claimed case as this volunteer (a different one)
  to show the double-claim rejection message.

**4:00 - Feeding, TNR, and adoption workflows**
- Still as the volunteer, on the newly-claimed kitten case: create a feeding
  schedule (e.g. "Daily at 8am", location note), then log a feeding with a
  food type - both appear immediately in the timeline.
- Go to the calico's profile (cat #2, seeded with an in-progress TNR record).
  Show the TNR status stepper - update it toward "released" and mention the
  cat's overall status will promote to "Released" unless it's already
  adopted or closed.
- Go to the tuxedo's profile (cat #3, seeded "available" for adoption).
  Update its adoption status toward "matched", entering an adopter contact -
  then reload the page and point out the contact field is never shown back,
  by design (write-only, private).

**5:30 - Community engagement and notifications**
- Sign out, sign in as user@pawpin.test again (who follows the orange tabby
  and the calico per the seed data).
- Open the notification bell - show the seeded notifications (case claimed,
  TNR update) and that opening the dropdown marks them read.
- On a cat profile, post a comment, then show the Follow/Bookmark buttons
  toggling state and persisting after a refresh.

**6:45 - Dashboards**
- Go to /dashboard/volunteer (as the volunteer) - show claimed cases with
  feeding/TNR badges, open urgent unclaimed cases, and today's feeding tasks.
- Sign in as org@pawpin.test and go to /dashboard/org - show the stat cards,
  unclaimed cases list, and the TNR/adoption pipeline breakdowns.

**7:45 - Data & security backbone**
- Mention: every coordination write (claim, feeding, TNR, adoption) runs
  through a SECURITY DEFINER Postgres function that checks the caller's role
  or case access before writing anything - not a client-trusted flag - and
  never regresses an already-adopted or closed cat's status.
- Mention: reporting still requires an account and EXIF stripping is an
  honestly-documented gap; both are called out directly in the docs rather
  than glossed over.

## Talking points to land the rubric

- Technical execution: a real Postgres schema, RLS, six coordination RPCs
  with atomic writes and self-authorization, a deterministic matching engine,
  73 passing unit tests, and a fully working volunteer-to-adoption pipeline.
- Innovation: persistent cat profiles carried all the way through to a real
  rescue workflow - not just a matching demo, but claim -> feed -> TNR/adopt.
- Theme: the complete lifecycle of a rescued stray, from a stranger's photo
  to a claimed case to feeding/TNR/adoption outcomes, with the community
  kept informed throughout.
- Security: RLS everywhere, a documented matching privacy boundary, and a
  documented coordination-RPC authorization pattern that explicitly closes
  the exact class of bug (role checks RLS can't express) found in our own
  M3 audit.
- UX/UI: real claim/feeding/TNR/adoption forms with honest role-gating (a
  plain user sees why they can't claim, not a broken button), a notification
  bell, and dashboards built from real queries, not mocked data.
- Documentation: this repo's docs and spec, kept in sync with what's
  actually shipped at every milestone, including this one.
