-- ===========================================================================
-- PawPin migration 0008 — M3 audit fixes: matching decision RPCs
--
-- Problem found in the M3 audit: the report-flow decision actions mutate
-- `cats`, `cases`, `case_events`, and `match_suggestions` on behalf of a
-- reporter who is NOT (yet) an authorised carer of the target cat. Under the
-- RLS policies from 0004/0006:
--   * `cats_update` requires admin/has_cat_access → a reporter's last_seen_at
--     bump silently affects 0 rows.
--   * `case_events_insert` requires admin/has_case_access/cat-creator → a
--     non-creator linking throws, breaking the whole flow.
--   * `match_update` requires admin/has_cat_access → the human-confirmation
--     decision is never persisted.
--
-- Fix: perform each decision atomically inside a SECURITY DEFINER function
-- with explicit internal authorization (caller must be the sighting's
-- reporter or an admin, and the sighting must still be pending). This mirrors
-- the get_match_candidates pattern, keeps RLS strict for direct table access,
-- and guarantees all-or-nothing writes (no orphan cat if a later step fails).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- link_sighting_to_cat: attach a pending sighting to an EXISTING cat profile.
-- Hardening: the target cat must have been a suggested match for this sighting
-- (present in match_suggestions), unless the caller is an admin — this stops a
-- user linking their sighting to an arbitrary, never-suggested cat.
-- ---------------------------------------------------------------------------
create or replace function public.link_sighting_to_cat(
  p_sighting_id uuid,
  p_cat_id uuid
)
returns table (result_cat_id uuid, result_case_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sighting public.sightings%rowtype;
  v_case_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_sighting from public.sightings where id = p_sighting_id;
  if not found then
    raise exception 'Sighting not found';
  end if;

  if v_sighting.reporter_id is distinct from v_uid and not public.is_admin() then
    raise exception 'You can only link a sighting you reported';
  end if;

  if v_sighting.cat_id is not null then
    raise exception 'This sighting is already linked to a cat profile';
  end if;

  if not exists (select 1 from public.cats where id = p_cat_id) then
    raise exception 'Cat profile not found';
  end if;

  if not public.is_admin()
     and not exists (
       select 1 from public.match_suggestions
       where sighting_id = p_sighting_id and candidate_cat_id = p_cat_id
     ) then
    raise exception 'Target cat is not a suggested match for this sighting';
  end if;

  -- 1. Link the sighting.
  update public.sightings set cat_id = p_cat_id where id = p_sighting_id;

  -- 2. Bump last_seen_at (never backdate); promote 'reported' -> 'active'
  --    but never regress a resolved status (adopted/released/closed/etc.).
  update public.cats
    set last_seen_at = greatest(last_seen_at, v_sighting.created_at),
        status = case when status = 'reported' then 'active'::case_status else status end
    where id = p_cat_id;

  -- 3. Find the cat's most recent case, or open one if none exists.
  select id into v_case_id
    from public.cases
    where cases.cat_id = p_cat_id
    order by opened_at desc
    limit 1;

  if v_case_id is null then
    insert into public.cases (cat_id, status, priority)
      values (p_cat_id, 'active', v_sighting.urgency)
      returning id into v_case_id;
  end if;

  -- 4. Timeline event.
  insert into public.case_events (case_id, type, actor_id, payload)
    values (
      v_case_id, 'sighting_linked', v_uid,
      jsonb_build_object(
        'message', 'New sighting linked to this cat profile',
        'sighting_id', p_sighting_id
      )
    );

  -- 5. Persist the human-confirmation decision trail.
  update public.match_suggestions
    set decision = 'linked', confirmed_by = v_uid, confirmed_at = now()
    where sighting_id = p_sighting_id and candidate_cat_id = p_cat_id;

  update public.match_suggestions
    set decision = 'rejected', confirmed_by = v_uid, confirmed_at = now()
    where sighting_id = p_sighting_id
      and candidate_cat_id <> p_cat_id
      and decision = 'pending';

  result_cat_id := p_cat_id;
  result_case_id := v_case_id;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_cat_from_sighting: create a NEW cat profile from a pending sighting
-- (used when no likely match, or the reporter rejects all candidates).
-- ---------------------------------------------------------------------------
create or replace function public.create_cat_from_sighting(
  p_sighting_id uuid,
  p_coat_color coat_color,
  p_fur_pattern fur_pattern,
  p_size_class size_class,
  p_age_group age_group,
  p_ear_tipped boolean,
  p_marks text[]
)
returns table (result_cat_id uuid, result_case_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sighting public.sightings%rowtype;
  v_cat_id uuid;
  v_case_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_sighting from public.sightings where id = p_sighting_id;
  if not found then
    raise exception 'Sighting not found';
  end if;

  if v_sighting.reporter_id is distinct from v_uid and not public.is_admin() then
    raise exception 'You can only create a profile from a sighting you reported';
  end if;

  if v_sighting.cat_id is not null then
    raise exception 'This sighting is already linked to a cat profile';
  end if;

  -- 1. New cat profile from the reported traits.
  insert into public.cats (
    status, coat_color, fur_pattern, size_class, age_group,
    distinguishing_marks, ear_tipped, primary_photo_id,
    first_seen_at, last_seen_at, created_by
  )
  values (
    'reported', p_coat_color, p_fur_pattern, p_size_class, p_age_group,
    coalesce(p_marks, '{}'), coalesce(p_ear_tipped, false), v_sighting.photo_id,
    v_sighting.created_at, v_sighting.created_at, v_uid
  )
  returning id into v_cat_id;

  -- 2. Link the sighting.
  update public.sightings set cat_id = v_cat_id where id = p_sighting_id;

  -- 3. Open a case.
  insert into public.cases (cat_id, status, priority)
    values (v_cat_id, 'reported', v_sighting.urgency)
    returning id into v_case_id;

  -- 4. Timeline event.
  insert into public.case_events (case_id, type, actor_id, payload)
    values (
      v_case_id, 'new_profile_created', v_uid,
      jsonb_build_object(
        'message', 'New cat profile created from sighting',
        'sighting_id', p_sighting_id
      )
    );

  -- 5. Any suggested candidates were rejected in favour of a new profile.
  update public.match_suggestions
    set decision = 'rejected', confirmed_by = v_uid, confirmed_at = now()
    where sighting_id = p_sighting_id and decision = 'pending';

  result_cat_id := v_cat_id;
  result_case_id := v_case_id;
  return next;
end;
$$;

-- Grant execution to authenticated users only (not anon). Each function does
-- its own caller authorization; RLS stays strict for direct table writes.
revoke all on function public.link_sighting_to_cat(uuid, uuid) from public;
grant execute on function public.link_sighting_to_cat(uuid, uuid) to authenticated;

revoke all on function public.create_cat_from_sighting(uuid, coat_color, fur_pattern, size_class, age_group, boolean, text[]) from public;
grant execute on function public.create_cat_from_sighting(uuid, coat_color, fur_pattern, size_class, age_group, boolean, text[]) to authenticated;
