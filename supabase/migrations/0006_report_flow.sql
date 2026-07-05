-- ===========================================================================
-- PawPin migration 0006 — M2 report flow support
--   1. Allow a reporting user to create the INITIAL case for a cat they
--      created (cases_insert was previously admin/org/volunteer only).
--   2. Allow a reporting user to append the initial case_event for a case
--      they just opened (case_events_insert previously required
--      has_case_access, which a plain reporter does not have).
--   3. Public map aggregation view: cats joined with their most recent
--      fuzzed sighting location — still no precise coordinates.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) cases: allow the cat's creator to open the first case for their cat.
-- ---------------------------------------------------------------------------
drop policy if exists cases_insert on public.cases;
create policy cases_insert on public.cases
  for insert to authenticated
  with check (
    public.is_admin()
    or public.is_org()
    or public.is_volunteer()
    or exists (
      select 1 from public.cats c
      where c.id = cat_id and c.created_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 2) case_events: allow the case opener (reporter) to append events on a case
--    they just created, in addition to admins/authorised carers.
-- ---------------------------------------------------------------------------
drop policy if exists case_events_insert on public.case_events;
create policy case_events_insert on public.case_events
  for insert to authenticated
  with check (
    public.is_admin()
    or public.has_case_access(case_id)
    or exists (
      select 1 from public.cases c
      join public.cats ct on ct.id = c.cat_id
      where c.id = case_id and ct.created_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Public map aggregation: one row per cat with its latest fuzzed sighting.
-- Never selects raw sightings.lat/lng. Safe for anon + authenticated.
-- ---------------------------------------------------------------------------
create or replace view public.cats_map_public as
select
  c.id                    as cat_id,
  c.status                as status,
  c.coat_color            as coat_color,
  c.fur_pattern           as fur_pattern,
  c.size_class            as size_class,
  c.age_group             as age_group,
  c.distinguishing_marks  as distinguishing_marks,
  c.ear_tipped            as ear_tipped,
  c.primary_photo_id      as primary_photo_id,
  c.last_seen_at          as last_seen_at,
  latest.urgency          as urgency,
  latest.condition_tags   as condition_tags,
  public.fuzz_coordinate(latest.lat) as fuzzed_lat,
  public.fuzz_coordinate(latest.lng) as fuzzed_lng,
  latest.created_at       as last_sighting_at
from public.cats c
join lateral (
  select s.lat, s.lng, s.urgency, s.condition_tags, s.created_at
  from public.sightings s
  where s.cat_id = c.id
  order by s.created_at desc
  limit 1
) latest on true;

grant select on public.cats_map_public to anon, authenticated;
