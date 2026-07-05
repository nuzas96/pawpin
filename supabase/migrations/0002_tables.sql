-- ===========================================================================
-- PawPin migration 0002 — tables, indexes, updated_at triggers
-- ===========================================================================

-- Shared helper: keep updated_at fresh on UPDATE.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  contact_email text,
  is_approved   boolean not null default false,
  verified_by   uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  role         user_role not null default 'user',
  display_name text,
  org_id       uuid references public.organizations (id) on delete set null,
  is_approved  boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_profiles_org on public.profiles (org_id);

-- ---------------------------------------------------------------------------
-- photos
-- ---------------------------------------------------------------------------
create table if not exists public.photos (
  id           uuid primary key default gen_random_uuid(),
  storage_path text not null,
  uploaded_by  uuid references auth.users (id) on delete set null,
  width        integer,
  height       integer,
  mime         text,
  sha256       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_photos_uploader on public.photos (uploaded_by);

-- ---------------------------------------------------------------------------
-- cats (the persistent profile)
-- ---------------------------------------------------------------------------
create table if not exists public.cats (
  id                   uuid primary key default gen_random_uuid(),
  status               case_status not null default 'reported',
  coat_color           coat_color not null,
  fur_pattern          fur_pattern not null,
  size_class           size_class not null,
  age_group            age_group not null default 'unknown',
  distinguishing_marks text[] not null default '{}',
  ear_tipped           boolean not null default false,
  primary_photo_id     uuid references public.photos (id) on delete set null,
  first_seen_at        timestamptz not null default now(),
  last_seen_at         timestamptz not null default now(),
  created_by           uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists idx_cats_status on public.cats (status);
create index if not exists idx_cats_traits on public.cats (coat_color, fur_pattern, size_class);
create index if not exists idx_cats_last_seen on public.cats (last_seen_at desc);

-- ---------------------------------------------------------------------------
-- sightings (precise coordinates live here; RLS-protected)
-- ---------------------------------------------------------------------------
create table if not exists public.sightings (
  id             uuid primary key default gen_random_uuid(),
  cat_id         uuid references public.cats (id) on delete set null,
  reporter_id    uuid references auth.users (id) on delete set null,
  photo_id       uuid references public.photos (id) on delete set null,
  lat            double precision not null,
  lng            double precision not null,
  urgency        urgency_level not null default 'medium',
  condition_tags text[] not null default '{}',
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint sightings_lat_range check (lat between -90 and 90),
  constraint sightings_lng_range check (lng between -180 and 180)
);
create index if not exists idx_sightings_cat on public.sightings (cat_id);
create index if not exists idx_sightings_reporter on public.sightings (reporter_id);
create index if not exists idx_sightings_created on public.sightings (created_at desc);
-- Bounding-box index to accelerate proximity queries used by matching.
create index if not exists idx_sightings_geo on public.sightings (lat, lng);

-- ---------------------------------------------------------------------------
-- cases (coordination unit for a cat)
-- ---------------------------------------------------------------------------
create table if not exists public.cases (
  id         uuid primary key default gen_random_uuid(),
  cat_id     uuid not null references public.cats (id) on delete cascade,
  status     case_status not null default 'reported',
  claimed_by uuid references auth.users (id) on delete set null,
  org_id     uuid references public.organizations (id) on delete set null,
  priority   urgency_level not null default 'medium',
  opened_at  timestamptz not null default now(),
  closed_at  timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_cases_cat on public.cases (cat_id);
create index if not exists idx_cases_status on public.cases (status);
create index if not exists idx_cases_claimed_by on public.cases (claimed_by);
create index if not exists idx_cases_org on public.cases (org_id);

-- ---------------------------------------------------------------------------
-- case_events (append-only timeline)
-- ---------------------------------------------------------------------------
create table if not exists public.case_events (
  id         uuid primary key default gen_random_uuid(),
  case_id    uuid not null references public.cases (id) on delete cascade,
  type       text not null,
  actor_id   uuid references auth.users (id) on delete set null,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_case_events_case on public.case_events (case_id, created_at);

-- ---------------------------------------------------------------------------
-- feeding_schedules & feeding_logs
-- ---------------------------------------------------------------------------
create table if not exists public.feeding_schedules (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid not null references public.cases (id) on delete cascade,
  created_by    uuid references auth.users (id) on delete set null,
  schedule_text text not null,
  location_note text,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_feeding_schedules_case on public.feeding_schedules (case_id);

create table if not exists public.feeding_logs (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references public.cases (id) on delete cascade,
  schedule_id uuid references public.feeding_schedules (id) on delete set null,
  fed_by      uuid references auth.users (id) on delete set null,
  fed_at      timestamptz not null default now(),
  notes       text,
  photo_id    uuid references public.photos (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_feeding_logs_case on public.feeding_logs (case_id, fed_at desc);

-- ---------------------------------------------------------------------------
-- tnr_records
-- ---------------------------------------------------------------------------
create table if not exists public.tnr_records (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references public.cases (id) on delete cascade,
  tnr_status  tnr_status not null default 'not_started',
  clinic      text,
  trapped_at  timestamptz,
  neutered_at timestamptz,
  returned_at timestamptz,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_tnr_case on public.tnr_records (case_id);

-- ---------------------------------------------------------------------------
-- adoptions (minimal PII)
-- ---------------------------------------------------------------------------
create table if not exists public.adoptions (
  id              uuid primary key default gen_random_uuid(),
  cat_id          uuid not null references public.cats (id) on delete cascade,
  adopter_contact text,
  status          text not null default 'inquiry',
  finalized_at    timestamptz,
  handled_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_adoptions_cat on public.adoptions (cat_id);

-- ---------------------------------------------------------------------------
-- comments (plain text; never rendered as HTML)
-- ---------------------------------------------------------------------------
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  cat_id     uuid references public.cats (id) on delete cascade,
  case_id    uuid references public.cases (id) on delete cascade,
  author_id  uuid references auth.users (id) on delete set null,
  body       text not null,
  is_hidden  boolean not null default false,
  created_at timestamptz not null default now(),
  constraint comments_target_present check (cat_id is not null or case_id is not null)
);
create index if not exists idx_comments_cat on public.comments (cat_id, created_at);
create index if not exists idx_comments_case on public.comments (case_id, created_at);

-- ---------------------------------------------------------------------------
-- follows & bookmarks (composite PKs)
-- ---------------------------------------------------------------------------
create table if not exists public.follows (
  user_id    uuid not null references auth.users (id) on delete cascade,
  cat_id     uuid not null references public.cats (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, cat_id)
);

create table if not exists public.bookmarks (
  user_id    uuid not null references auth.users (id) on delete cascade,
  cat_id     uuid not null references public.cats (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, cat_id)
);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  type       text not null,
  payload    jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- moderation_flags
-- ---------------------------------------------------------------------------
create table if not exists public.moderation_flags (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id   uuid not null,
  reason      flag_reason not null,
  details     text,
  reported_by uuid references auth.users (id) on delete set null,
  status      text not null default 'open',
  resolved_by uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_mod_flags_status on public.moderation_flags (status, created_at desc);

-- ---------------------------------------------------------------------------
-- audit_logs (insert-only; admin-read)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references auth.users (id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  diff       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_entity on public.audit_logs (entity, created_at desc);

-- ---------------------------------------------------------------------------
-- match_suggestions (persisted matching results + human-confirmation trail)
-- ---------------------------------------------------------------------------
create table if not exists public.match_suggestions (
  id               uuid primary key default gen_random_uuid(),
  sighting_id      uuid not null references public.sightings (id) on delete cascade,
  candidate_cat_id uuid not null references public.cats (id) on delete cascade,
  score            integer not null check (score between 0 and 100),
  reasons          jsonb not null default '[]'::jsonb,
  confirmed_by     uuid references auth.users (id) on delete set null,
  decision         text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_match_sighting on public.match_suggestions (sighting_id, score desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'organizations','profiles','photos','cats','sightings','cases',
    'feeding_schedules','tnr_records','adoptions'
  ]
  loop
    execute format(
      'drop trigger if exists trg_%1$s_updated_at on public.%1$s;', t
    );
    execute format(
      'create trigger trg_%1$s_updated_at before update on public.%1$s
         for each row execute function set_updated_at();', t
    );
  end loop;
end $$;
