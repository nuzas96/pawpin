-- ===========================================================================
-- PawPin migration 0001 — extensions & enums
-- Run order: 0001 → 0002 → 0003 → 0004 → 0005 → 0006, then seed.sql (optional).
-- ===========================================================================

-- pgcrypto provides gen_random_uuid() for UUID primary keys.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- Stored roles only. "guest" (unauthenticated) is intentionally NOT a value.
do $$ begin
  create type user_role as enum ('user', 'volunteer', 'org', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type case_status as enum (
    'reported', 'under_review', 'active', 'tnr_in_progress', 'medical',
    'ready_for_adoption', 'adopted', 'released', 'closed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type urgency_level as enum ('low', 'medium', 'high', 'critical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type coat_color as enum (
    'black', 'white', 'grey', 'orange', 'brown', 'calico', 'tabby',
    'tortoiseshell', 'tuxedo', 'mixed', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type fur_pattern as enum (
    'solid', 'tabby', 'bicolor', 'tricolor', 'pointed', 'spotted', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type size_class as enum ('kitten', 'small', 'medium', 'large');
exception when duplicate_object then null; end $$;

do $$ begin
  create type age_group as enum ('kitten', 'juvenile', 'adult', 'senior', 'unknown');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tnr_status as enum ('not_started', 'trapped', 'neutered', 'recovering', 'returned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type feeding_type as enum ('scheduled', 'ad_hoc');
exception when duplicate_object then null; end $$;

do $$ begin
  create type flag_reason as enum ('spam', 'inappropriate', 'duplicate', 'wrong_info', 'abuse', 'other');
exception when duplicate_object then null; end $$;
