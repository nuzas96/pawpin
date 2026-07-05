-- ===========================================================================
-- PawPin seed.sql — demo data for judges
-- ===========================================================================
-- Run AFTER migrations 0001–0010, in the Supabase SQL Editor (runs as the
-- postgres superuser, which bypasses RLS — correct for seeding).
--
-- This seed creates five demo auth users with known passwords (four core
-- roles + one pending volunteer). If your Supabase project disallows direct
-- auth.users inserts, see README.md for the manual "create accounts in the
-- dashboard, then run the profile section" fallback.
--
-- Matching demo (M3): cat #1 (orange tabby) has three prior sightings close
-- together in time/place, PLUS a fourth, still-PENDING sighting with a
-- pre-computed "pending" match_suggestions row — open /report as
-- user@pawpin.test and submit an orange tabby sighting near
-- lat 1.3521, lng 103.8198 to see a fresh possible-match review, or inspect
-- the seeded pending suggestion directly via match_suggestions. Cats #2–#7
-- have distinct coat colours/patterns/locations so they should NOT match #1.
--
-- Coordination demo (M4): case #1 (orange tabby) is CLAIMED by the demo
-- volunteer, with an active feeding schedule + logs. Case #2 (calico) has an
-- in-progress TNR record (neutered, ear-tipped, recovering). Case #5 (black
-- kitten) is an UNCLAIMED critical-priority case — sign in as
-- volunteer@pawpin.test and visit /dashboard/volunteer or /cases to claim it.
-- Adoption pipeline: cat #3 is "available", cat #4 is "matched", cat #6 is
-- "adopted" (closed lifecycle). Comments, follows, bookmarks, and
-- notifications are seeded across several cats to exercise the community
-- features and the notifications dropdown immediately.
--
-- Governance demo (M5): `pending_volunteer@pawpin.test` is an UNAPPROVED
-- volunteer account — sign in as admin@pawpin.test and visit /admin/users to
-- approve them (or leave unapproved to see the "pending approval" dashboard
-- message when signed in as that account). "Alley Cat Rescue 2" is an
-- UNAPPROVED organisation — visit /admin/organizations to approve/reject it.
-- Two open moderation flags exist (one on a comment, one on a cat profile) —
-- visit /admin/flags to dismiss/resolve/hide-comment/close-case. Cat #2's
-- second comment is pre-HIDDEN (is_hidden=true) to demonstrate that normal
-- users don't see it while admins do (with an Unhide control). Case #4
-- (grey cat, medical) is a good candidate to demonstrate reassignment,
-- close, and archive from its cat profile's case-governance controls.
-- Several explicit audit_logs rows are seeded so /admin/audit-logs has
-- filterable content immediately.
--
-- Demo credentials (ALL demo-only — never use in production):
--   user@pawpin.test            / PawPinDemo123
--   volunteer@pawpin.test       / PawPinDemo123
--   org@pawpin.test             / PawPinDemo123
--   admin@pawpin.test           / PawPinDemo123
--   pending_volunteer@pawpin.test / PawPinDemo123
-- ===========================================================================

begin;

-- Fixed UUIDs so cross-references are stable and re-runnable.
-- Users
--   user      : 11111111-1111-1111-1111-111111111111
--   volunteer : 22222222-2222-2222-2222-222222222222
--   org member: 33333333-3333-3333-3333-333333333333
--   admin     : 44444444-4444-4444-4444-444444444444

-- ---------------------------------------------------------------------------
-- 1) Demo auth users (idempotent). Passwords are bcrypt-hashed via pgcrypto.
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'user@pawpin.test',
   crypt('PawPinDemo123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Demo User"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'volunteer@pawpin.test',
   crypt('PawPinDemo123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Demo Volunteer"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333',
   'authenticated', 'authenticated', 'org@pawpin.test',
   crypt('PawPinDemo123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Alley Cat Rescue"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444',
   'authenticated', 'authenticated', 'admin@pawpin.test',
   crypt('PawPinDemo123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Demo Admin"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '55555555-5555-5555-5555-555555555555',
   'authenticated', 'authenticated', 'pending_volunteer@pawpin.test',
   crypt('PawPinDemo123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Pending Volunteer"}',
   now(), now(), '', '', '', '')
on conflict (id) do nothing;

-- Provide email identities (required for email login on newer Supabase).
insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
values
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'user@pawpin.test',
   '{"sub":"11111111-1111-1111-1111-111111111111","email":"user@pawpin.test"}', 'email', now(), now(), now()),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'volunteer@pawpin.test',
   '{"sub":"22222222-2222-2222-2222-222222222222","email":"volunteer@pawpin.test"}', 'email', now(), now(), now()),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'org@pawpin.test',
   '{"sub":"33333333-3333-3333-3333-333333333333","email":"org@pawpin.test"}', 'email', now(), now(), now()),
  (gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'admin@pawpin.test',
   '{"sub":"44444444-4444-4444-4444-444444444444","email":"admin@pawpin.test"}', 'email', now(), now(), now()),
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'pending_volunteer@pawpin.test',
   '{"sub":"55555555-5555-5555-5555-555555555555","email":"pending_volunteer@pawpin.test"}', 'email', now(), now(), now())
on conflict do nothing;

-- The handle_new_user() trigger created public.profiles rows (role='user').

-- ---------------------------------------------------------------------------
-- 2) Organisation + assign roles.
--    Temporarily disable the profile guard so we can set elevated roles
--    (the guard blocks non-admin role changes during normal operation).
-- ---------------------------------------------------------------------------
insert into public.organizations (id, name, contact_email, is_approved, verified_by)
values ('a0000000-0000-0000-0000-000000000001', 'Alley Cat Rescue',
        'contact@alleycatrescue.test', true, '44444444-4444-4444-4444-444444444444')
on conflict (id) do nothing;

-- A second, PENDING organisation for the M5 approval-queue demo.
insert into public.organizations (id, name, contact_email, is_approved)
values ('a0000000-0000-0000-0000-000000000002', 'Paws & Whiskers Rescue',
        'hello@pawswhiskers.test', false)
on conflict (id) do nothing;

alter table public.profiles disable trigger trg_profile_guard;

update public.profiles set display_name = 'Demo User', role = 'user'
  where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set display_name = 'Demo Volunteer', role = 'volunteer'
  where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set display_name = 'Alley Cat Rescue', role = 'org',
  org_id = 'a0000000-0000-0000-0000-000000000001'
  where id = '33333333-3333-3333-3333-333333333333';
update public.profiles set display_name = 'Demo Admin', role = 'admin'
  where id = '44444444-4444-4444-4444-444444444444';
-- PENDING volunteer: role set but is_approved=false, for the M5
-- approval-queue demo. This account will see a "pending approval" message on
-- /dashboard/volunteer and cannot claim cases until an admin approves it.
update public.profiles set display_name = 'Pending Volunteer', role = 'volunteer', is_approved = false
  where id = '55555555-5555-5555-5555-555555555555';

alter table public.profiles enable trigger trg_profile_guard;

-- ---------------------------------------------------------------------------
-- 3) Photos (metadata rows; storage_path points at the public bucket).
-- ---------------------------------------------------------------------------
insert into public.photos (id, storage_path, uploaded_by, width, height, mime)
values
  ('b0000000-0000-0000-0000-000000000001', 'seed/orange-tabby.jpg', '11111111-1111-1111-1111-111111111111', 800, 600, 'image/jpeg'),
  ('b0000000-0000-0000-0000-000000000002', 'seed/calico.jpg',       '11111111-1111-1111-1111-111111111111', 800, 600, 'image/jpeg'),
  ('b0000000-0000-0000-0000-000000000003', 'seed/tuxedo.jpg',       '22222222-2222-2222-2222-222222222222', 800, 600, 'image/jpeg')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 4) Cats (persistent profiles) across statuses.
-- ---------------------------------------------------------------------------
insert into public.cats (id, status, coat_color, fur_pattern, size_class, age_group, distinguishing_marks, ear_tipped, primary_photo_id, first_seen_at, last_seen_at, created_by)
values
  -- Orange tabby: the multi-sighting matching demo star.
  ('c0000000-0000-0000-0000-000000000001', 'active', 'orange', 'tabby', 'medium', 'adult',
   array['white chest patch','notched right ear'], false, 'b0000000-0000-0000-0000-000000000001',
   now() - interval '30 days', now() - interval '2 days', '11111111-1111-1111-1111-111111111111'),
  -- Calico with a distinctive mark.
  ('c0000000-0000-0000-0000-000000000002', 'tnr_in_progress', 'calico', 'tricolor', 'small', 'adult',
   array['left ear notch'], true, 'b0000000-0000-0000-0000-000000000002',
   now() - interval '20 days', now() - interval '5 days', '11111111-1111-1111-1111-111111111111'),
  -- Tuxedo, ready for adoption.
  ('c0000000-0000-0000-0000-000000000003', 'ready_for_adoption', 'tuxedo', 'bicolor', 'medium', 'juvenile',
   array['white socks'], false, 'b0000000-0000-0000-0000-000000000003',
   now() - interval '15 days', now() - interval '1 days', '22222222-2222-2222-2222-222222222222'),
  -- Grey, medical.
  ('c0000000-0000-0000-0000-000000000004', 'medical', 'grey', 'solid', 'large', 'senior',
   array['limping hind leg'], false, null,
   now() - interval '10 days', now() - interval '3 days', '22222222-2222-2222-2222-222222222222'),
  -- Black kitten, reported (unclaimed).
  ('c0000000-0000-0000-0000-000000000005', 'reported', 'black', 'solid', 'kitten', 'kitten',
   array[]::text[], false, null,
   now() - interval '3 days', now() - interval '3 days', '11111111-1111-1111-1111-111111111111'),
  -- Brown tabby, adopted (closed lifecycle example).
  ('c0000000-0000-0000-0000-000000000006', 'adopted', 'brown', 'tabby', 'medium', 'adult',
   array['scar over left eye'], true, null,
   now() - interval '60 days', now() - interval '10 days', '33333333-3333-3333-3333-333333333333'),
  -- Released after TNR.
  ('c0000000-0000-0000-0000-000000000007', 'released', 'tabby', 'tabby', 'medium', 'adult',
   array['tipped left ear'], true, null,
   now() - interval '90 days', now() - interval '40 days', '33333333-3333-3333-3333-333333333333'),
  -- Closed (governance demo): a case an admin formally closed without an
  -- adoption/release outcome, e.g. the reporter never saw the cat again.
  ('c0000000-0000-0000-0000-000000000008', 'closed', 'white', 'solid', 'medium', 'adult',
   array[]::text[], false, null,
   now() - interval '25 days', now() - interval '20 days', '11111111-1111-1111-1111-111111111111'),
  -- Archived (governance demo): a stale/duplicate report set aside by an
  -- admin, distinct from a resolved "closed" outcome.
  ('c0000000-0000-0000-0000-000000000009', 'archived', 'grey', 'tabby', 'small', 'adult',
   array[]::text[], false, null,
   now() - interval '35 days', now() - interval '30 days', '22222222-2222-2222-2222-222222222222')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 5) Sightings (precise coords; clustered in one city area).
--    Three sightings of the orange tabby seed the matching demo.
-- ---------------------------------------------------------------------------
insert into public.sightings (id, cat_id, reporter_id, photo_id, lat, lng, urgency, condition_tags, notes, created_at)
values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'b0000000-0000-0000-0000-000000000001', 1.352100, 103.819800, 'medium', array['friendly','underweight'], 'Orange tabby near the void deck.', now() - interval '30 days'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', null, 1.352600, 103.820300, 'medium', array['friendly'], 'Same orange cat, ate some food.', now() - interval '12 days'),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', null, 1.351900, 103.819500, 'high', array['limping'], 'Orange tabby limping slightly today.', now() - interval '2 days'),
  ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'b0000000-0000-0000-0000-000000000002', 1.353400, 103.821000, 'low', array['ear-tipped'], 'Calico resting by the carpark.', now() - interval '5 days'),
  ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'b0000000-0000-0000-0000-000000000003', 1.350800, 103.818900, 'medium', array['friendly','healthy'], 'Young tuxedo, very social.', now() - interval '1 days'),
  ('d0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', null, 1.354000, 103.822000, 'critical', array['very young','alone'], 'Tiny black kitten alone, needs help.', now() - interval '3 days')
on conflict (id) do nothing;

-- Sightings for the two case-governance demo cats (#8 closed, #9 archived).
insert into public.sightings (id, cat_id, reporter_id, photo_id, lat, lng, urgency, condition_tags, notes, created_at)
values
  ('d0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', null, 1.349000, 103.817000, 'medium', array['friendly'], 'White cat near the market, only seen once.', now() - interval '25 days'),
  ('d0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222', null, 1.355500, 103.823500, 'low', array[]::text[], 'Possibly a duplicate of an earlier report.', now() - interval '35 days')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 6) Cases across statuses (audit trigger auto-logs these inserts).
-- ---------------------------------------------------------------------------
insert into public.cases (id, cat_id, status, claimed_by, org_id, priority, opened_at, closed_at)
values
  -- Orange tabby: claimed by the volunteer (unlocks precise location for them).
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'active',
   '22222222-2222-2222-2222-222222222222', 'a0000000-0000-0000-0000-000000000001', 'high',
   now() - interval '28 days', null),
  ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'tnr_in_progress',
   '22222222-2222-2222-2222-222222222222', 'a0000000-0000-0000-0000-000000000001', 'medium',
   now() - interval '18 days', null),
  ('e0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', 'ready_for_adoption',
   null, 'a0000000-0000-0000-0000-000000000001', 'medium', now() - interval '14 days', null),
  ('e0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000004', 'medical',
   '22222222-2222-2222-2222-222222222222', 'a0000000-0000-0000-0000-000000000001', 'critical',
   now() - interval '9 days', null),
  -- Unclaimed kitten case.
  ('e0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000005', 'reported',
   null, null, 'critical', now() - interval '3 days', null),
  ('e0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000006', 'adopted',
   '22222222-2222-2222-2222-222222222222', 'a0000000-0000-0000-0000-000000000001', 'low',
   now() - interval '58 days', now() - interval '10 days'),
  ('e0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000007', 'released',
   '22222222-2222-2222-2222-222222222222', 'a0000000-0000-0000-0000-000000000001', 'low',
   now() - interval '88 days', now() - interval '40 days'),
  -- Closed (governance demo): admin-closed, no adoption/release outcome.
  ('e0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000008', 'closed',
   null, null, 'medium', now() - interval '25 days', now() - interval '20 days'),
  -- Archived (governance demo): stale/duplicate, set aside by an admin.
  ('e0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000009', 'archived',
   null, null, 'low', now() - interval '35 days', now() - interval '30 days')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 7) Case timeline events.
-- ---------------------------------------------------------------------------
insert into public.case_events (case_id, type, actor_id, payload, created_at)
values
  ('e0000000-0000-0000-0000-000000000001', 'reported',  '11111111-1111-1111-1111-111111111111', '{"note":"Cat first reported"}', now() - interval '30 days'),
  ('e0000000-0000-0000-0000-000000000001', 'claimed',   '22222222-2222-2222-2222-222222222222', '{"note":"Volunteer claimed the case"}', now() - interval '28 days'),
  ('e0000000-0000-0000-0000-000000000001', 'status_change', '22222222-2222-2222-2222-222222222222', '{"from":"reported","to":"active"}', now() - interval '27 days'),
  ('e0000000-0000-0000-0000-000000000002', 'tnr_update', '22222222-2222-2222-2222-222222222222', '{"note":"Scheduled for trapping"}', now() - interval '16 days'),
  ('e0000000-0000-0000-0000-000000000004', 'medical',   '33333333-3333-3333-3333-333333333333', '{"note":"Vet visit arranged for leg injury"}', now() - interval '8 days'),
  ('e0000000-0000-0000-0000-000000000008', 'case_closed', '44444444-4444-4444-4444-444444444444', '{"message":"Case closed — reporter no longer sees the cat in the area"}', now() - interval '20 days'),
  ('e0000000-0000-0000-0000-000000000009', 'case_archived', '44444444-4444-4444-4444-444444444444', '{"message":"Archived as a likely duplicate report"}', now() - interval '30 days');

-- ---------------------------------------------------------------------------
-- 8) Feeding schedule + logs.
-- ---------------------------------------------------------------------------
insert into public.feeding_schedules (id, case_id, created_by, schedule_text, location_note, frequency, next_feeding_at, active)
values ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001',
        '22222222-2222-2222-2222-222222222222', 'Daily at 7pm', 'Behind Block 123 void deck',
        'daily', (current_date + interval '1 day' + interval '19 hours'), true)
on conflict (id) do nothing;

insert into public.feeding_logs (case_id, schedule_id, fed_by, fed_at, food_type, notes)
values
  ('e0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', now() - interval '2 days', 'Wet food', 'Ate well, seemed alert.'),
  ('e0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', now() - interval '1 days', 'Dry kibble', 'Left a little food, watching the limp.');

-- ---------------------------------------------------------------------------
-- 9) TNR records (audit trigger logs these). Cat #2 is mid-workflow
--    ("neutered", ear-tipped, recovering) — the clear "TNR in progress" demo.
-- ---------------------------------------------------------------------------
insert into public.tnr_records (case_id, tnr_status, clinic, scheduled_at, trapped_at, neutered_at, notes)
values ('e0000000-0000-0000-0000-000000000002', 'neutered', 'Community Vet Clinic',
        now() - interval '16 days', now() - interval '15 days', now() - interval '14 days',
        'Recovering well; ear-tipped.');

-- ---------------------------------------------------------------------------
-- 10) Adoption records (audit trigger logs these; minimal PII).
--     Three examples across the pipeline: available (tuxedo, cat #3),
--     matched (grey, cat #4 — recovering, matched pending a home check), and
--     adopted (brown tabby, cat #6 — closed lifecycle example).
-- ---------------------------------------------------------------------------
insert into public.adoptions (cat_id, adopter_contact, status, finalized_at, handled_by)
values
  ('c0000000-0000-0000-0000-000000000003', null, 'available', null, '22222222-2222-2222-2222-222222222222'),
  ('c0000000-0000-0000-0000-000000000004', 'interested adopter (contact on file)', 'matched', null, '33333333-3333-3333-3333-333333333333'),
  ('c0000000-0000-0000-0000-000000000006', 'adopter (contact on file)', 'adopted',
   now() - interval '10 days', '33333333-3333-3333-3333-333333333333');

-- ---------------------------------------------------------------------------
-- 11) Comments (plain text). One is pre-HIDDEN for the M5 moderation demo.
-- ---------------------------------------------------------------------------
insert into public.comments (cat_id, author_id, body, is_hidden)
values
  ('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'I see this orange cat near my block most evenings.', false),
  ('c0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Thanks! I have started a feeding schedule and am watching the limp.', false),
  ('c0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Such a friendly tuxedo — hope it finds a home soon!', false),
  ('c0000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'Is anyone able to check on this kitten today? It looked very small and alone.', false),
  ('c0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Buy cheap supplements at scam-site.example — not related to this cat!', true);

-- ---------------------------------------------------------------------------
-- 12) Follows & bookmarks.
-- ---------------------------------------------------------------------------
insert into public.follows (user_id, cat_id)
values
  ('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-000000000001'),
  ('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-000000000002'),
  ('22222222-2222-2222-2222-222222222222', 'c0000000-0000-0000-0000-000000000004')
on conflict do nothing;

insert into public.bookmarks (user_id, cat_id)
values
  ('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-000000000003'),
  ('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-000000000004')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 13) Notifications — one per notification-trigger scenario described in
--     the M4 spec (case claimed, case update, TNR update, adoption update).
-- ---------------------------------------------------------------------------
insert into public.notifications (user_id, type, payload)
values
  ('11111111-1111-1111-1111-111111111111', 'case_claimed',
   '{"cat_id":"c0000000-0000-0000-0000-000000000001","message":"A volunteer claimed a case for a cat you follow."}'),
  ('11111111-1111-1111-1111-111111111111', 'tnr_update',
   '{"cat_id":"c0000000-0000-0000-0000-000000000002","tnr_status":"neutered","message":"TNR status updated for a cat you follow."}'),
  ('22222222-2222-2222-2222-222222222222', 'adoption_update',
   '{"cat_id":"c0000000-0000-0000-0000-000000000004","adoption_status":"matched","message":"Adoption status updated for a cat you follow."}'),
  ('22222222-2222-2222-2222-222222222222', 'new_sighting',
   '{"cat_id":"c0000000-0000-0000-0000-000000000001","message":"New sighting logged for a cat you are caring for."}');

-- ---------------------------------------------------------------------------
-- 14) Moderation flags. Two OPEN flags (one on the hidden-comment example,
--     one on a cat profile) for the /admin/flags review demo, plus one
--     already-resolved example so "Recently reviewed" has content too.
-- ---------------------------------------------------------------------------
insert into public.moderation_flags (target_type, target_id, reason, details, reported_by, status)
values
  ('comment',
   (select id from public.comments where body like 'Buy cheap supplements%' limit 1),
   'spam', 'This comment looks like spam unrelated to the cat.',
   '11111111-1111-1111-1111-111111111111', 'open'),
  ('cat', 'c0000000-0000-0000-0000-000000000004', 'wrong_info',
   'Not sure this cat''s condition tags are accurate — might need a second look.',
   '22222222-2222-2222-2222-222222222222', 'open');

insert into public.moderation_flags (target_type, target_id, reason, details, reported_by, status, resolved_by, resolved_at, resolution_note)
values
  ('comment', (select id from public.comments where cat_id = 'c0000000-0000-0000-0000-000000000001' limit 1),
   'duplicate', 'Reported by mistake, same as another comment.',
   '11111111-1111-1111-1111-111111111111', 'dismissed',
   '44444444-4444-4444-4444-444444444444', now() - interval '1 day', 'Not actually a duplicate — dismissed.');

-- ---------------------------------------------------------------------------
-- 15) Pre-computed match suggestions (orange tabby) so the matching screen
--     has content even before a judge submits a new report. This one is
--     already resolved ("linked") to show a completed decision.
-- ---------------------------------------------------------------------------
insert into public.match_suggestions (sighting_id, candidate_cat_id, score, reasons, decision, confirmed_by, confirmed_at)
values
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 88,
   '[{"signal":"Coat colour","contribution":22,"detail":"Both reported as orange"},
     {"signal":"Fur pattern","contribution":15,"detail":"Both tabby"},
     {"signal":"Distinguishing marks","contribution":18,"detail":"Shared: notched right ear"},
     {"signal":"Distance","contribution":14,"detail":"~40m from prior sighting"},
     {"signal":"Recency","contribution":6,"detail":"Seen within the last 2 weeks"}]'::jsonb,
   'linked', '11111111-1111-1111-1111-111111111111', now() - interval '2 days');

-- ---------------------------------------------------------------------------
-- 15b) A fresh PENDING sighting of the orange tabby, left unlinked
--      (cat_id IS NULL) with a PENDING match suggestion — this is exactly the
--      state a judge would see immediately after submitting a new report
--      that resembles cat #1. Demonstrates the matching review UI without
--      requiring a live report submission first.
-- ---------------------------------------------------------------------------
insert into public.sightings (id, cat_id, reporter_id, photo_id, lat, lng, urgency, condition_tags, notes, created_at)
values
  ('d0000000-0000-0000-0000-000000000007', null, '11111111-1111-1111-1111-111111111111', null,
   1.352050, 103.819750, 'medium', array['friendly'],
   'Possibly the same orange tabby again, near the usual spot.', now() - interval '2 hours')
on conflict (id) do nothing;

insert into public.match_suggestions (sighting_id, candidate_cat_id, score, reasons, decision)
values
  ('d0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000001', 91,
   '[{"signal":"Coat colour","contribution":22,"detail":"Both reported as orange"},
     {"signal":"Fur pattern","contribution":15,"detail":"Both tabby"},
     {"signal":"Distinguishing marks","contribution":18,"detail":"Shared: white chest patch, notched right ear"},
     {"signal":"Distance","contribution":15,"detail":"~15m from prior sighting"},
     {"signal":"Recency","contribution":6,"detail":"Seen earlier today"}]'::jsonb,
   'pending')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 16) Explicit audit log examples (in addition to trigger-generated rows).
--     These mirror what the M5 admin RPCs write via log_admin_action(), so
--     /admin/audit-logs has realistic, filterable content immediately.
-- ---------------------------------------------------------------------------
insert into public.audit_logs (actor_id, action, entity, entity_id, diff, created_at)
values
  ('44444444-4444-4444-4444-444444444444', 'SEED', 'system', null,
   '{"note":"Demo data seeded"}', now() - interval '30 days'),
  ('44444444-4444-4444-4444-444444444444', 'update_user_role', 'profiles',
   '22222222-2222-2222-2222-222222222222',
   '{"before":{"role":"user","is_approved":true},"after":{"role":"volunteer","is_approved":true}}',
   now() - interval '29 days'),
  ('44444444-4444-4444-4444-444444444444', 'approve_organization', 'organizations',
   'a0000000-0000-0000-0000-000000000001',
   '{"note":"Verified contact details by phone"}', now() - interval '29 days'),
  ('44444444-4444-4444-4444-444444444444', 'close_case', 'cases',
   'e0000000-0000-0000-0000-000000000008',
   '{"note":"Reporter no longer sees the cat in the area"}', now() - interval '20 days'),
  ('44444444-4444-4444-4444-444444444444', 'archive_case', 'cases',
   'e0000000-0000-0000-0000-000000000009',
   '{"note":"Archived as a likely duplicate report"}', now() - interval '30 days'),
  ('44444444-4444-4444-4444-444444444444', 'review_moderation_flag', 'moderation_flags',
   (select id from public.moderation_flags where status = 'dismissed' limit 1),
   '{"action":"dismiss","note":"Not actually a duplicate — dismissed.","target_type":"comment"}',
   now() - interval '1 day');

commit;
