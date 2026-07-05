-- ===========================================================================
-- PawPin migration 0009 — M4 volunteer coordination, feeding, TNR, adoption
-- Part 1: schema additions
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- feeding_schedules: structured frequency + next feeding time.
-- schedule_text is kept (free-text note e.g. "behind Block 123 void deck");
-- frequency/next_feeding_at are the new structured fields.
-- ---------------------------------------------------------------------------
do $$ begin
  create type feeding_frequency as enum ('once', 'daily', 'weekly', 'custom');
exception when duplicate_object then null; end $$;

alter table public.feeding_schedules
  add column if not exists frequency feeding_frequency not null default 'daily',
  add column if not exists next_feeding_at timestamptz;

-- ---------------------------------------------------------------------------
-- feeding_logs: food type (free-text, small enum-like note).
-- ---------------------------------------------------------------------------
alter table public.feeding_logs
  add column if not exists food_type text;

-- ---------------------------------------------------------------------------
-- tnr_status: expand enum to the full M4 workflow. Postgres enums are
-- append-only (values cannot be removed), so the original values
-- (not_started, trapped, neutered, recovering, returned) remain valid and
-- are treated as legacy-compatible synonyms:
--   recovering ≈ surgery_scheduled/neutered phase; returned ≈ released.
-- New values added: trap_planned, surgery_scheduled, ear_tipped, released.
-- ---------------------------------------------------------------------------
do $$ begin
  alter type tnr_status add value if not exists 'trap_planned' after 'not_started';
exception when duplicate_object then null; end $$;
do $$ begin
  alter type tnr_status add value if not exists 'surgery_scheduled' after 'trapped';
exception when duplicate_object then null; end $$;
do $$ begin
  alter type tnr_status add value if not exists 'ear_tipped' after 'neutered';
exception when duplicate_object then null; end $$;
do $$ begin
  alter type tnr_status add value if not exists 'released' after 'returned';
exception when duplicate_object then null; end $$;

-- Scheduled trapping date, in addition to the existing trapped_at/neutered_at/
-- returned_at actuals.
alter table public.tnr_records
  add column if not exists scheduled_at timestamptz;

-- ---------------------------------------------------------------------------
-- adoptions: constrain `status` (previously free text) to the M4 workflow.
-- Existing seed value 'inquiry'/'finalized'/'pending'/'approved'/'cancelled'
-- (from M0/M1 seed) are remapped to the new set before the constraint is
-- added, so this migration is safe to run against seeded data.
-- ---------------------------------------------------------------------------
update public.adoptions set status = 'available' where status = 'inquiry';
update public.adoptions set status = 'application_received' where status = 'pending';
update public.adoptions set status = 'matched' where status = 'approved';
update public.adoptions set status = 'adopted' where status = 'finalized';
update public.adoptions set status = 'not_available' where status = 'cancelled';

alter table public.adoptions
  drop constraint if exists adoptions_status_check;
alter table public.adoptions
  add constraint adoptions_status_check
  check (status in ('not_available', 'intake', 'available', 'application_received', 'matched', 'adopted'));

alter table public.adoptions
  alter column status set default 'not_available';


-- ===========================================================================
-- Part 2: SECURITY DEFINER RPCs
--
-- Lesson from the M3 audit: writes that require role-based authorization
-- beyond simple row ownership (e.g. "any volunteer may claim an unclaimed
-- case") are NOT reliably expressible as a server action doing plain
-- table writes under RLS, because RLS policies are keyed to
-- has_case_access()/has_cat_access() (claimed_by/org membership), which a
-- volunteer does not yet have *before* claiming. Each RPC below performs its
-- own explicit authorization check, then does all related writes atomically
-- in one transaction (case update + case_events + notifications).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- notify_followers: internal helper (not exposed to clients) — inserts a
-- notification row for every user following the given cat, except the actor
-- who triggered it (no self-notifications).
-- ---------------------------------------------------------------------------
create or replace function public.notify_followers(
  p_cat_id uuid,
  p_type text,
  p_payload jsonb,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, payload)
  select f.user_id, p_type, p_payload
  from public.follows f
  where f.cat_id = p_cat_id
    and (p_actor_id is null or f.user_id <> p_actor_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- claim_case: a volunteer/org/admin claims an unclaimed case.
-- Prevents double-claiming (raises if already claimed) unless the caller is
-- admin or an org member of the case's org, who may reassign/override.
-- ---------------------------------------------------------------------------
create or replace function public.claim_case(p_case_id uuid)
returns table (result_case_id uuid, result_claimed_by uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_case public.cases%rowtype;
  v_role text := public.current_user_role();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if v_role not in ('volunteer', 'org', 'admin') then
    raise exception 'Only volunteers, organisations, or admins can claim a case';
  end if;

  select * into v_case from public.cases where id = p_case_id;
  if not found then
    raise exception 'Case not found';
  end if;

  if v_case.claimed_by is not null and v_case.claimed_by <> v_uid then
    -- Already claimed by someone else: only admin or the case's own org may override.
    if not public.is_admin()
       and not (v_case.org_id is not null
                and v_case.org_id = (select org_id from public.profiles where id = v_uid)) then
      raise exception 'This case has already been claimed by another volunteer';
    end if;
  end if;

  update public.cases
    set claimed_by = v_uid,
        status = case when status = 'reported' then 'active'::case_status else status end
    where id = p_case_id;

  insert into public.case_events (case_id, type, actor_id, payload)
    values (p_case_id, 'case_claimed', v_uid, jsonb_build_object('message', 'Case claimed by volunteer'));

  perform public.notify_followers(
    v_case.cat_id, 'case_claimed',
    jsonb_build_object('cat_id', v_case.cat_id, 'case_id', p_case_id, 'message', 'A volunteer claimed a case for a cat you follow.'),
    v_uid
  );

  result_case_id := p_case_id;
  result_claimed_by := v_uid;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- add_case_update: append a free-text case_events entry of a given category.
-- Requires case access (claimed volunteer, org member, or admin) — a plain
-- reporter may not add case updates (they may still comment, see comments
-- table). p_category is one of: progress, medical, feeding, tnr, adoption,
-- general.
-- ---------------------------------------------------------------------------
create or replace function public.add_case_update(
  p_case_id uuid,
  p_category text,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_event_id uuid;
  v_cat_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if p_category not in ('progress', 'medical', 'feeding', 'tnr', 'adoption', 'general') then
    raise exception 'Invalid update category';
  end if;
  if not public.is_admin() and not public.has_case_access(p_case_id) then
    raise exception 'You do not have access to update this case';
  end if;

  insert into public.case_events (case_id, type, actor_id, payload)
    values (p_case_id, 'case_update_' || p_category, v_uid, jsonb_build_object('message', p_note, 'category', p_category))
    returning id into v_event_id;

  select cat_id into v_cat_id from public.cases where id = p_case_id;
  perform public.notify_followers(
    v_cat_id, 'case_update',
    jsonb_build_object('cat_id', v_cat_id, 'case_id', p_case_id, 'category', p_category, 'message', 'A cat you follow has a new case update.'),
    v_uid
  );

  return v_event_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_feeding_schedule: authorised carers create a feeding schedule for a
-- case. Appends a case_events entry.
-- ---------------------------------------------------------------------------
create or replace function public.create_feeding_schedule(
  p_case_id uuid,
  p_frequency feeding_frequency,
  p_schedule_text text,
  p_location_note text,
  p_next_feeding_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_schedule_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_admin() and not public.has_case_access(p_case_id) then
    raise exception 'You do not have access to manage feeding for this case';
  end if;

  insert into public.feeding_schedules (case_id, created_by, schedule_text, location_note, frequency, next_feeding_at, active)
    values (p_case_id, v_uid, p_schedule_text, p_location_note, p_frequency, p_next_feeding_at, true)
    returning id into v_schedule_id;

  insert into public.case_events (case_id, type, actor_id, payload)
    values (p_case_id, 'feeding_schedule_created', v_uid,
            jsonb_build_object('message', 'Feeding schedule created', 'schedule_id', v_schedule_id));

  return v_schedule_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- add_feeding_log: authorised carers record a completed feeding.
-- Appends a case_events entry.
-- ---------------------------------------------------------------------------
create or replace function public.add_feeding_log(
  p_case_id uuid,
  p_schedule_id uuid,
  p_fed_at timestamptz,
  p_food_type text,
  p_notes text,
  p_photo_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_log_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_admin() and not public.has_case_access(p_case_id) then
    raise exception 'You do not have access to log feeding for this case';
  end if;

  insert into public.feeding_logs (case_id, schedule_id, fed_by, fed_at, food_type, notes, photo_id)
    values (p_case_id, p_schedule_id, v_uid, coalesce(p_fed_at, now()), p_food_type, p_notes, p_photo_id)
    returning id into v_log_id;

  insert into public.case_events (case_id, type, actor_id, payload)
    values (p_case_id, 'feeding_logged', v_uid,
            jsonb_build_object('message', 'Feeding completed', 'log_id', v_log_id));

  return v_log_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- update_tnr_record: authorised carers create/update the TNR record for a
-- case. If status reaches 'released', promotes the cat status to 'released'
-- UNLESS the cat is already 'adopted' or 'closed' (never regress a resolved
-- outcome).
-- ---------------------------------------------------------------------------
create or replace function public.update_tnr_record(
  p_case_id uuid,
  p_tnr_status tnr_status,
  p_clinic text,
  p_scheduled_at timestamptz,
  p_trapped_at timestamptz,
  p_neutered_at timestamptz,
  p_returned_at timestamptz,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_record_id uuid;
  v_cat_id uuid;
  v_cat_status case_status;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_admin() and not public.has_case_access(p_case_id) then
    raise exception 'You do not have access to manage TNR for this case';
  end if;

  select cat_id into v_cat_id from public.cases where id = p_case_id;
  if v_cat_id is null then
    raise exception 'Case not found';
  end if;

  select id into v_record_id from public.tnr_records where case_id = p_case_id;

  if v_record_id is null then
    insert into public.tnr_records (case_id, tnr_status, clinic, scheduled_at, trapped_at, neutered_at, returned_at, notes)
      values (p_case_id, p_tnr_status, p_clinic, p_scheduled_at, p_trapped_at, p_neutered_at, p_returned_at, p_notes)
      returning id into v_record_id;
  else
    update public.tnr_records
      set tnr_status = p_tnr_status,
          clinic = coalesce(p_clinic, clinic),
          scheduled_at = coalesce(p_scheduled_at, scheduled_at),
          trapped_at = coalesce(p_trapped_at, trapped_at),
          neutered_at = coalesce(p_neutered_at, neutered_at),
          returned_at = coalesce(p_returned_at, returned_at),
          notes = coalesce(p_notes, notes)
      where id = v_record_id;
  end if;

  insert into public.case_events (case_id, type, actor_id, payload)
    values (p_case_id, 'tnr_update', v_uid,
            jsonb_build_object('message', 'TNR status updated to ' || p_tnr_status::text, 'tnr_status', p_tnr_status));

  if p_tnr_status = 'released' then
    select status into v_cat_status from public.cats where id = v_cat_id;
    if v_cat_status not in ('adopted', 'closed') then
      update public.cats set status = 'released' where id = v_cat_id;
      update public.cases set status = 'released' where id = p_case_id;
    end if;
  end if;

  perform public.notify_followers(
    v_cat_id, 'tnr_update',
    jsonb_build_object('cat_id', v_cat_id, 'case_id', p_case_id, 'tnr_status', p_tnr_status, 'message', 'TNR status updated for a cat you follow.'),
    v_uid
  );

  return v_record_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- update_adoption_record: authorised carers create/update the adoption
-- record for a cat. adopter_contact is write-only from the client's
-- perspective in practice (RLS on `adoptions` already restricts SELECT to
-- admin/has_cat_access — see 0004_rls.sql — so it is never publicly
-- readable). If status becomes 'adopted', promotes cat/case status to
-- 'adopted' UNLESS already 'closed'.
-- ---------------------------------------------------------------------------
create or replace function public.update_adoption_record(
  p_cat_id uuid,
  p_status text,
  p_adopter_contact text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_record_id uuid;
  v_cat_status case_status;
  v_case_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if p_status not in ('not_available', 'intake', 'available', 'application_received', 'matched', 'adopted') then
    raise exception 'Invalid adoption status';
  end if;
  if not public.is_admin() and not public.has_cat_access(p_cat_id) then
    raise exception 'You do not have access to manage adoption for this cat';
  end if;

  select id into v_record_id from public.adoptions where cat_id = p_cat_id;

  if v_record_id is null then
    insert into public.adoptions (cat_id, status, adopter_contact, handled_by, finalized_at)
      values (p_cat_id, p_status, p_adopter_contact, v_uid, case when p_status = 'adopted' then now() else null end)
      returning id into v_record_id;
  else
    update public.adoptions
      set status = p_status,
          adopter_contact = coalesce(p_adopter_contact, adopter_contact),
          handled_by = v_uid,
          finalized_at = case when p_status = 'adopted' then now() else finalized_at end
      where id = v_record_id;
  end if;

  select id into v_case_id from public.cases where cat_id = p_cat_id order by opened_at desc limit 1;
  if v_case_id is not null then
    insert into public.case_events (case_id, type, actor_id, payload)
      values (v_case_id, 'adoption_update', v_uid,
              jsonb_build_object('message', 'Adoption status updated to ' || p_status, 'adoption_status', p_status));
  end if;

  if p_status = 'adopted' then
    select status into v_cat_status from public.cats where id = p_cat_id;
    if v_cat_status <> 'closed' then
      update public.cats set status = 'adopted' where id = p_cat_id;
      if v_case_id is not null then
        update public.cases set status = 'adopted', closed_at = now() where id = v_case_id;
      end if;
    end if;
  end if;

  perform public.notify_followers(
    p_cat_id, 'adoption_update',
    jsonb_build_object('cat_id', p_cat_id, 'adoption_status', p_status, 'message', 'Adoption status updated for a cat you follow.'),
    v_uid
  );

  return v_record_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: authenticated only, never anon.
-- ---------------------------------------------------------------------------
revoke all on function public.claim_case(uuid) from public;
grant execute on function public.claim_case(uuid) to authenticated;

revoke all on function public.add_case_update(uuid, text, text) from public;
grant execute on function public.add_case_update(uuid, text, text) to authenticated;

revoke all on function public.create_feeding_schedule(uuid, feeding_frequency, text, text, timestamptz) from public;
grant execute on function public.create_feeding_schedule(uuid, feeding_frequency, text, text, timestamptz) to authenticated;

revoke all on function public.add_feeding_log(uuid, uuid, timestamptz, text, text, uuid) from public;
grant execute on function public.add_feeding_log(uuid, uuid, timestamptz, text, text, uuid) to authenticated;

revoke all on function public.update_tnr_record(uuid, tnr_status, text, timestamptz, timestamptz, timestamptz, timestamptz, text) from public;
grant execute on function public.update_tnr_record(uuid, tnr_status, text, timestamptz, timestamptz, timestamptz, timestamptz, text) to authenticated;

revoke all on function public.update_adoption_record(uuid, text, text) from public;
grant execute on function public.update_adoption_record(uuid, text, text) to authenticated;


-- ===========================================================================
-- Part 3: notifications for status changes + linked sightings
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Trigger: notify followers whenever a cat's status changes.
-- ---------------------------------------------------------------------------
create or replace function public.notify_on_cat_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform public.notify_followers(
      new.id, 'status_change',
      jsonb_build_object(
        'cat_id', new.id, 'from_status', old.status, 'to_status', new.status,
        'message', 'A cat you follow changed status: ' || old.status::text || ' -> ' || new.status::text
      ),
      auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_cat_status_change on public.cats;
create trigger trg_notify_cat_status_change
  after update on public.cats
  for each row execute function public.notify_on_cat_status_change();

-- ---------------------------------------------------------------------------
-- Update link_sighting_to_cat (migration 0008) to also notify followers that
-- a new sighting was linked to a cat they follow. Re-created in full since
-- Postgres does not support partial function bodies.
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

  update public.sightings set cat_id = p_cat_id where id = p_sighting_id;

  update public.cats
    set last_seen_at = greatest(last_seen_at, v_sighting.created_at),
        status = case when status = 'reported' then 'active'::case_status else status end
    where id = p_cat_id;

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

  insert into public.case_events (case_id, type, actor_id, payload)
    values (
      v_case_id, 'sighting_linked', v_uid,
      jsonb_build_object(
        'message', 'New sighting linked to this cat profile',
        'sighting_id', p_sighting_id
      )
    );

  update public.match_suggestions
    set decision = 'linked', confirmed_by = v_uid, confirmed_at = now()
    where sighting_id = p_sighting_id and candidate_cat_id = p_cat_id;

  update public.match_suggestions
    set decision = 'rejected', confirmed_by = v_uid, confirmed_at = now()
    where sighting_id = p_sighting_id
      and candidate_cat_id <> p_cat_id
      and decision = 'pending';

  perform public.notify_followers(
    p_cat_id, 'new_sighting',
    jsonb_build_object('cat_id', p_cat_id, 'sighting_id', p_sighting_id, 'message', 'A new sighting was linked to a cat you follow.'),
    v_uid
  );

  result_cat_id := p_cat_id;
  result_case_id := v_case_id;
  return next;
end;
$$;

grant execute on function public.link_sighting_to_cat(uuid, uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- Index to speed up notify_followers() lookups by cat.
-- ---------------------------------------------------------------------------
create index if not exists idx_follows_cat on public.follows (cat_id);
