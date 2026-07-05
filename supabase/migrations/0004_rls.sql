-- ===========================================================================
-- PawPin migration 0004 — Row Level Security: enable + policies
-- Depends on helper functions from 0003.
-- Model: guest = anon role (no JWT); user/volunteer/org/admin = authenticated
-- role whose privileges are resolved from public.profiles.
-- ===========================================================================

-- Enable RLS on every table.
alter table public.organizations     enable row level security;
alter table public.profiles          enable row level security;
alter table public.photos            enable row level security;
alter table public.cats              enable row level security;
alter table public.sightings         enable row level security;
alter table public.cases             enable row level security;
alter table public.case_events       enable row level security;
alter table public.feeding_schedules enable row level security;
alter table public.feeding_logs      enable row level security;
alter table public.tnr_records       enable row level security;
alter table public.adoptions         enable row level security;
alter table public.comments          enable row level security;
alter table public.follows           enable row level security;
alter table public.bookmarks         enable row level security;
alter table public.notifications     enable row level security;
alter table public.moderation_flags  enable row level security;
alter table public.audit_logs        enable row level security;
alter table public.match_suggestions enable row level security;

-- ---------------------------------------------------------------------------
-- profiles: read own or admin; update own (role/org locked by trigger below).
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Prevent non-admins from escalating their own role / org / approval.
create or replace function public.enforce_profile_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.role is distinct from old.role
       or new.org_id is distinct from old.org_id
       or new.is_approved is distinct from old.is_approved then
      raise exception 'Only an admin can change role, org, or approval status.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_profile_guard on public.profiles;
create trigger trg_profile_guard
  before update on public.profiles
  for each row execute function public.enforce_profile_guard();

-- ---------------------------------------------------------------------------
-- organizations: public reads approved; members/admin read own; admin writes.
-- ---------------------------------------------------------------------------
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
  for select to anon, authenticated
  using (
    is_approved = true
    or public.is_admin()
    or id = (select org_id from public.profiles where id = auth.uid())
  );

drop policy if exists organizations_insert on public.organizations;
create policy organizations_insert on public.organizations
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists organizations_update on public.organizations;
create policy organizations_update on public.organizations
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- photos: public read (non-sensitive); owner inserts; owner/admin manage.
-- ---------------------------------------------------------------------------
drop policy if exists photos_select on public.photos;
create policy photos_select on public.photos
  for select to anon, authenticated using (true);

drop policy if exists photos_insert on public.photos;
create policy photos_insert on public.photos
  for insert to authenticated
  with check (uploaded_by = auth.uid());

drop policy if exists photos_update on public.photos;
create policy photos_update on public.photos
  for update to authenticated
  using (uploaded_by = auth.uid() or public.is_admin())
  with check (uploaded_by = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- cats: public read (no precise coords stored here); authed create;
--        admin / authorised carers update.
-- ---------------------------------------------------------------------------
drop policy if exists cats_select on public.cats;
create policy cats_select on public.cats
  for select to anon, authenticated using (true);

drop policy if exists cats_insert on public.cats;
create policy cats_insert on public.cats
  for insert to authenticated
  with check (created_by = auth.uid() or created_by is null);

drop policy if exists cats_update on public.cats;
create policy cats_update on public.cats
  for update to authenticated
  using (public.is_admin() or public.has_cat_access(id))
  with check (public.is_admin() or public.has_cat_access(id));

-- ---------------------------------------------------------------------------
-- sightings: PRECISE coordinates. NOT readable by guests / normal users.
-- Readable only by the reporter, admins, or authorised carers of the cat.
-- Public map consumers use public.sighting_geo_public instead.
-- ---------------------------------------------------------------------------
drop policy if exists sightings_select on public.sightings;
create policy sightings_select on public.sightings
  for select to authenticated
  using (
    reporter_id = auth.uid()
    or public.is_admin()
    or (cat_id is not null and public.has_cat_access(cat_id))
  );

drop policy if exists sightings_insert on public.sightings;
create policy sightings_insert on public.sightings
  for insert to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists sightings_update on public.sightings;
create policy sightings_update on public.sightings
  for update to authenticated
  using (public.is_admin() or (cat_id is not null and public.has_cat_access(cat_id)))
  with check (public.is_admin() or (cat_id is not null and public.has_cat_access(cat_id)));

-- ---------------------------------------------------------------------------
-- cases: authed read; claim + manage per role.
-- ---------------------------------------------------------------------------
drop policy if exists cases_select on public.cases;
create policy cases_select on public.cases
  for select to authenticated using (true);

drop policy if exists cases_insert on public.cases;
create policy cases_insert on public.cases
  for insert to authenticated
  with check (public.is_admin() or public.is_org() or public.is_volunteer());

drop policy if exists cases_update on public.cases;
create policy cases_update on public.cases
  for update to authenticated
  using (
    public.is_admin()
    or claimed_by = auth.uid()
    or (org_id is not null and org_id = (select org_id from public.profiles where id = auth.uid()))
    or (claimed_by is null and public.is_volunteer())
  )
  with check (
    public.is_admin()
    or claimed_by = auth.uid()
    or (org_id is not null and org_id = (select org_id from public.profiles where id = auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- case_events: authed read timeline; authorised carers/admin append.
-- ---------------------------------------------------------------------------
drop policy if exists case_events_select on public.case_events;
create policy case_events_select on public.case_events
  for select to authenticated using (true);

drop policy if exists case_events_insert on public.case_events;
create policy case_events_insert on public.case_events
  for insert to authenticated
  with check (public.is_admin() or public.has_case_access(case_id));

-- ---------------------------------------------------------------------------
-- feeding_schedules & feeding_logs: authed read; authorised carers manage.
-- ---------------------------------------------------------------------------
drop policy if exists feeding_schedules_select on public.feeding_schedules;
create policy feeding_schedules_select on public.feeding_schedules
  for select to authenticated using (true);

drop policy if exists feeding_schedules_write on public.feeding_schedules;
create policy feeding_schedules_write on public.feeding_schedules
  for all to authenticated
  using (public.is_admin() or public.has_case_access(case_id))
  with check (public.is_admin() or public.has_case_access(case_id));

drop policy if exists feeding_logs_select on public.feeding_logs;
create policy feeding_logs_select on public.feeding_logs
  for select to authenticated using (true);

drop policy if exists feeding_logs_write on public.feeding_logs;
create policy feeding_logs_write on public.feeding_logs
  for all to authenticated
  using (public.is_admin() or public.has_case_access(case_id))
  with check (public.is_admin() or public.has_case_access(case_id));

-- ---------------------------------------------------------------------------
-- tnr_records: authed read summary; authorised carers manage.
-- ---------------------------------------------------------------------------
drop policy if exists tnr_select on public.tnr_records;
create policy tnr_select on public.tnr_records
  for select to authenticated using (true);

drop policy if exists tnr_write on public.tnr_records;
create policy tnr_write on public.tnr_records
  for all to authenticated
  using (public.is_admin() or public.has_case_access(case_id))
  with check (public.is_admin() or public.has_case_access(case_id));

-- ---------------------------------------------------------------------------
-- adoptions: contains adopter contact (PII) — restricted to admin/carers.
-- ---------------------------------------------------------------------------
drop policy if exists adoptions_select on public.adoptions;
create policy adoptions_select on public.adoptions
  for select to authenticated
  using (public.is_admin() or public.has_cat_access(cat_id));

drop policy if exists adoptions_write on public.adoptions;
create policy adoptions_write on public.adoptions
  for all to authenticated
  using (public.is_admin() or public.has_cat_access(cat_id))
  with check (public.is_admin() or public.has_cat_access(cat_id));

-- ---------------------------------------------------------------------------
-- comments: plain text. Everyone sees non-hidden; authors/admin see own/all.
-- Authenticated users insert as themselves; admins moderate (hide).
-- ---------------------------------------------------------------------------
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
  for select to anon, authenticated
  using (is_hidden = false or public.is_admin() or author_id = auth.uid());

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert to authenticated
  with check (author_id = auth.uid());

drop policy if exists comments_moderate on public.comments;
create policy comments_moderate on public.comments
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- follows / bookmarks / notifications: strictly own rows.
-- ---------------------------------------------------------------------------
drop policy if exists follows_all on public.follows;
create policy follows_all on public.follows
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists bookmarks_all on public.bookmarks;
create policy bookmarks_all on public.bookmarks
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- moderation_flags: authed users report; only admins read/resolve.
-- ---------------------------------------------------------------------------
drop policy if exists mod_flags_insert on public.moderation_flags;
create policy mod_flags_insert on public.moderation_flags
  for insert to authenticated
  with check (reported_by = auth.uid());

drop policy if exists mod_flags_select on public.moderation_flags;
create policy mod_flags_select on public.moderation_flags
  for select to authenticated
  using (public.is_admin() or reported_by = auth.uid());

drop policy if exists mod_flags_update on public.moderation_flags;
create policy mod_flags_update on public.moderation_flags
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- audit_logs: admin-read only. No client INSERT/UPDATE/DELETE policy exists,
-- so those are denied; rows are written only by the SECURITY DEFINER trigger.
-- ---------------------------------------------------------------------------
drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- match_suggestions: authed read; authed create; authorised carers/admin
-- confirm (link/reject).
-- ---------------------------------------------------------------------------
drop policy if exists match_select on public.match_suggestions;
create policy match_select on public.match_suggestions
  for select to authenticated using (true);

drop policy if exists match_insert on public.match_suggestions;
create policy match_insert on public.match_suggestions
  for insert to authenticated with check (true);

drop policy if exists match_update on public.match_suggestions;
create policy match_update on public.match_suggestions
  for update to authenticated
  using (public.is_admin() or public.has_cat_access(candidate_cat_id))
  with check (public.is_admin() or public.has_cat_access(candidate_cat_id));
