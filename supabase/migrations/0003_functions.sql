-- ===========================================================================
-- PawPin migration 0003 — functions: auth helpers, location privacy,
--                         profile provisioning, audit logging
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- RLS helper functions
-- SECURITY DEFINER so they can read public.profiles regardless of the caller's
-- own row-level visibility. search_path pinned to avoid hijacking.
-- ---------------------------------------------------------------------------

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role::text from public.profiles where id = auth.uid()),
    'guest'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_volunteer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'volunteer'
  );
$$;

create or replace function public.is_org()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'org'
  );
$$;

-- True if the caller may access PRECISE case/location data for this case:
--   - admins always
--   - the volunteer who claimed the case
--   - a member of the organisation assigned to the case
create or replace function public.has_case_access(target_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cases c
    where c.id = target_case_id
      and (
        public.is_admin()
        or c.claimed_by = auth.uid()
        or (
          c.org_id is not null
          and c.org_id = (select org_id from public.profiles where id = auth.uid())
        )
      )
  );
$$;

-- True if caller may access precise location for a given cat (any of its cases).
create or replace function public.has_cat_access(target_cat_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.cases c
    where c.cat_id = target_cat_id
      and (
        c.claimed_by = auth.uid()
        or (
          c.org_id is not null
          and c.org_id = (select org_id from public.profiles where id = auth.uid())
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Location privacy: coordinate fuzzing
-- Rounds coordinates to ~3 decimal places (~110m grid) then adds a small
-- deterministic-per-value jitter, so public consumers never receive precise
-- GPS. This is applied in SQL (see the public view below) and cannot be
-- bypassed by clients because the raw sightings.lat/lng are not selectable by
-- guests/normal users under RLS (migration 0004).
-- ---------------------------------------------------------------------------
create or replace function public.fuzz_coordinate(value double precision)
returns double precision
language sql
immutable
as $$
  -- Round to 3 dp (~110m), then jitter within +/- ~0.0015 deg (~150-200m)
  -- using a stable hash of the value so the fuzz is consistent per coordinate.
  select round(value::numeric, 3)::double precision
    + (((abs(hashtext(value::text)) % 3000)::double precision - 1500) / 1000000.0);
$$;

-- ---------------------------------------------------------------------------
-- Public, privacy-preserving view of sightings for the map.
-- Exposes only fuzzed coordinates and non-sensitive fields. This view is the
-- ONLY geo source that guests and normal users read.
-- security_invoker = false (default for views): the view owner evaluates it,
-- but it selects only already-non-sensitive columns + fuzzed coords.
-- ---------------------------------------------------------------------------
create or replace view public.sighting_geo_public as
select
  s.id            as sighting_id,
  s.cat_id        as cat_id,
  public.fuzz_coordinate(s.lat) as fuzzed_lat,
  public.fuzz_coordinate(s.lng) as fuzzed_lng,
  s.urgency       as urgency,
  c.status        as status,
  s.created_at    as created_at
from public.sightings s
left join public.cats c on c.id = s.cat_id;

-- Expose the public view to anon + authenticated (RLS on base table still
-- protects precise columns; this view never selects them raw).
grant select on public.sighting_geo_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Profile provisioning: create a public.profiles row when a user signs up.
-- display_name is taken from signup metadata; role always defaults to 'user'
-- (privilege escalation via client metadata is therefore impossible).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    'user',
    nullif(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Audit logging via triggers on sensitive tables. Insert-only from triggers;
-- runs as definer so it can always write regardless of caller RLS.
-- ---------------------------------------------------------------------------
create or replace function public.log_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  entity_id uuid;
begin
  entity_id := coalesce(
    (case when tg_op = 'DELETE' then old.id else new.id end),
    null
  );
  insert into public.audit_logs (actor_id, action, entity, entity_id, diff)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    entity_id,
    case
      when tg_op = 'DELETE' then jsonb_build_object('old', to_jsonb(old))
      when tg_op = 'INSERT' then jsonb_build_object('new', to_jsonb(new))
      else jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
    end
  );
  return coalesce(new, old);
end;
$$;

-- Attach audit triggers to sensitive tables.
do $$
declare t text;
begin
  foreach t in array array['cases','moderation_flags','adoptions','tnr_records']
  loop
    execute format('drop trigger if exists trg_audit_%1$s on public.%1$s;', t);
    execute format(
      'create trigger trg_audit_%1$s
         after insert or update or delete on public.%1$s
         for each row execute function public.log_audit_event();', t
    );
  end loop;
end $$;
