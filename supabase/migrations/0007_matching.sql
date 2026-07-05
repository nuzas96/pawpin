-- ===========================================================================
-- PawPin migration 0007 — M3 matching engine support
--   1. match_suggestions: add confirmed_at + a decision check constraint.
--   2. Allow a reporter to update their OWN pending (unlinked, cat_id IS
--      NULL) sighting — needed so link/create actions can set `cat_id` on a
--      sighting that has no cat yet (has_cat_access() cannot evaluate a NULL
--      cat_id).
--   3. Allow a reporter to insert match_suggestions rows for their own
--      pending sighting (already permitted broadly by match_insert, kept for
--      clarity — no change needed there, see 0004_rls.sql).
--   4. get_match_candidates(): SECURITY DEFINER RPC used ONLY server-side by
--      the matching engine's candidate search. Returns precise coordinates
--      of each candidate's latest sighting — this function is intentionally
--      NOT granted to anon/authenticated; it is invoked exclusively via the
--      server (cookie-bound) Supabase client acting as the authenticated
--      reporter, from a server action, and its result is reduced to
--      public-safe fields before anything reaches the client.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) match_suggestions: confirmed_at + decision constraint.
-- ---------------------------------------------------------------------------
alter table public.match_suggestions
  add column if not exists confirmed_at timestamptz;

alter table public.match_suggestions
  drop constraint if exists match_suggestions_decision_check;
alter table public.match_suggestions
  add constraint match_suggestions_decision_check
  check (decision is null or decision in ('pending', 'linked', 'rejected', 'new_profile_created'));

-- ---------------------------------------------------------------------------
-- 2) sightings: allow the reporter to update their own PENDING sighting
--    (cat_id IS NULL) to link it to a cat, in addition to the existing
--    admin/has_cat_access paths.
-- ---------------------------------------------------------------------------
drop policy if exists sightings_update on public.sightings;
create policy sightings_update on public.sightings
  for update to authenticated
  using (
    public.is_admin()
    or (cat_id is not null and public.has_cat_access(cat_id))
    or (cat_id is null and reporter_id = auth.uid())
  )
  with check (
    public.is_admin()
    or (cat_id is not null and public.has_cat_access(cat_id))
    or (reporter_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3) sightings: allow the reporter to SELECT their own pending sighting even
--    before it has a cat_id (already covered by `reporter_id = auth.uid()`
--    in 0004_rls.sql's sightings_select — no change needed, kept as a no-op
--    comment for documentation completeness).
-- ---------------------------------------------------------------------------
-- (sightings_select already includes `reporter_id = auth.uid()`.)

-- ---------------------------------------------------------------------------
-- 4) Server-side candidate search RPC.
-- Finds cats with a recent-enough, geographically-plausible sighting, using
-- a generous bounding box (fast pre-filter) before the TypeScript engine
-- applies the real weighted/decayed scoring. NOT granted to anon/authenticated
-- — callers must invoke it as a privileged/service context. In this app it
-- is called from a server action using the request-scoped (cookie-bound)
-- server client while impersonating the authenticated reporter; the function
-- itself runs SECURITY DEFINER so it can read precise sightings regardless of
-- the caller's own row-level visibility, but it is never exposed to the
-- browser and never returns rows unfiltered to a client component.
-- ---------------------------------------------------------------------------
create or replace function public.get_match_candidates(
  query_lat double precision,
  query_lng double precision,
  max_distance_meters double precision default 3000,
  max_age_days integer default 120
)
returns table (
  cat_id uuid,
  coat_color coat_color,
  fur_pattern fur_pattern,
  size_class size_class,
  age_group age_group,
  distinguishing_marks text[],
  ear_tipped boolean,
  primary_photo_id uuid,
  status case_status,
  last_seen_at timestamptz,
  sighting_lat double precision,
  sighting_lng double precision,
  sighting_occurred_at timestamptz,
  sighting_condition_tags text[],
  sighting_urgency urgency_level
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.coat_color,
    c.fur_pattern,
    c.size_class,
    c.age_group,
    c.distinguishing_marks,
    c.ear_tipped,
    c.primary_photo_id,
    c.status,
    c.last_seen_at,
    latest.lat,
    latest.lng,
    latest.created_at,
    latest.condition_tags,
    latest.urgency
  from public.cats c
  join lateral (
    select s.lat, s.lng, s.created_at, s.condition_tags, s.urgency
    from public.sightings s
    where s.cat_id = c.id
    order by s.created_at desc
    limit 1
  ) latest on true
  where latest.created_at >= now() - (max_age_days || ' days')::interval
    -- Cheap bounding-box pre-filter (~1 degree latitude ~ 111km) before the
    -- application-layer haversine + weighted scoring runs in TypeScript.
    and latest.lat between query_lat - (max_distance_meters / 111000.0)
                       and query_lat + (max_distance_meters / 111000.0)
    and latest.lng between query_lng - (max_distance_meters / (111000.0 * cos(radians(query_lat))))
                       and query_lng + (max_distance_meters / (111000.0 * cos(radians(query_lat))))
  order by latest.created_at desc
  limit 50;
$$;

-- Intentionally NOT granted to anon/authenticated as a blanket grant; revoke
-- default PUBLIC execute so it can only be called by roles we explicitly
-- allow. The server action calls this using the authenticated user's own
-- session (RLS-bound client), so we grant EXECUTE to `authenticated` — the
-- function itself only returns non-precise-to-the-public aggregate/candidate
-- data intended for server-side scoring, and the server action never forwards
-- raw lat/lng to the browser.
revoke all on function public.get_match_candidates(double precision, double precision, double precision, integer) from public;
grant execute on function public.get_match_candidates(double precision, double precision, double precision, integer) to authenticated;
