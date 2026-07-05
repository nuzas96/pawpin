-- ===========================================================================
-- PawPin migration 0010 — M5 admin moderation, org approval, role management,
-- audit logs, case governance
-- Part 1: schema additions
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- case_status: add 'archived' (Postgres enums are append-only). Archived is
-- distinct from 'closed' — closed means a resolved outcome (adopted/released/
-- etc. already recorded), archived means the case was set aside by an admin
-- (e.g. stale, duplicate, or otherwise no longer actionable) without implying
-- a resolved outcome.
-- ---------------------------------------------------------------------------
do $$ begin
  alter type case_status add value if not exists 'archived' after 'closed';
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- moderation_flags: constrain `status` (previously free text) to a clear
-- workflow, and add a `resolved_at` + `resolution_note` for the admin's
-- decision record.
-- ---------------------------------------------------------------------------
alter table public.moderation_flags
  add column if not exists resolved_at timestamptz,
  add column if not exists resolution_note text;

alter table public.moderation_flags
  drop constraint if exists moderation_flags_status_check;
alter table public.moderation_flags
  add constraint moderation_flags_status_check
  check (status in ('open', 'reviewing', 'dismissed', 'resolved'));

-- ---------------------------------------------------------------------------
-- organizations: admin note field for approval/rejection reasoning.
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column if not exists admin_note text;

-- Helpful index for the admin audit-log viewer's filters.
create index if not exists idx_audit_action on public.audit_logs (action, created_at desc);


-- ===========================================================================
-- Part 2: SECURITY DEFINER RPCs
--
-- Pattern established in M3/M4: any write that needs role-based or
-- ownership-beyond-RLS authorization, or that must write to admin-only
-- tables like audit_logs (which has NO client insert policy at all — see
-- 0004_rls.sql), runs inside a SECURITY DEFINER function that performs its
-- own explicit check and all related writes atomically.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- log_admin_action: internal helper (not exposed to clients) — inserts an
-- audit_logs row. Distinct from the trigger-based log_audit_event() (which
-- only fires on cases/moderation_flags/adoptions/tnr_records DML): this one
-- is called explicitly by admin RPCs so the audit entry can carry a
-- purpose-built diff/summary rather than a raw row dump.
-- ---------------------------------------------------------------------------
create or replace function public.log_admin_action(
  p_action text,
  p_entity text,
  p_entity_id uuid,
  p_diff jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_id uuid;
begin
  insert into public.audit_logs (actor_id, action, entity, entity_id, diff)
    values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_diff, '{}'::jsonb))
    returning id into v_log_id;
  return v_log_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- update_user_role: admin-only role/approval change.
-- Guards:
--   - caller must be admin (checked here, in addition to the
--     enforce_profile_guard trigger from 0004_rls.sql — belt-and-suspenders,
--     since this RPC bypasses that trigger's caller-role check only in the
--     sense that it also runs as the admin's own session, so the trigger
--     still applies and still passes for a genuine admin).
--   - an admin cannot demote THEIR OWN account away from 'admin' (prevents
--     accidentally locking themselves out of admin tooling). An admin CAN
--     still change other admins' roles, and can change their own
--     display-adjacent fields via the normal profile update path.
-- ---------------------------------------------------------------------------
create or replace function public.update_user_role(
  p_user_id uuid,
  p_role user_role,
  p_is_approved boolean,
  p_org_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_old public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_admin() then
    raise exception 'Only an admin can change user roles';
  end if;

  select * into v_old from public.profiles where id = p_user_id;
  if not found then
    raise exception 'User profile not found';
  end if;

  if p_user_id = v_uid and v_old.role = 'admin' and p_role <> 'admin' then
    raise exception 'You cannot remove your own admin role. Ask another admin to do this if it is really intended.';
  end if;

  update public.profiles
    set role = p_role,
        is_approved = p_is_approved,
        org_id = p_org_id
    where id = p_user_id;

  perform public.log_admin_action(
    'update_user_role', 'profiles', p_user_id,
    jsonb_build_object(
      'before', jsonb_build_object('role', v_old.role, 'is_approved', v_old.is_approved, 'org_id', v_old.org_id),
      'after', jsonb_build_object('role', p_role, 'is_approved', p_is_approved, 'org_id', p_org_id)
    )
  );

  return p_user_id;
end;
$$;

revoke all on function public.update_user_role(uuid, user_role, boolean, uuid) from public;
grant execute on function public.update_user_role(uuid, user_role, boolean, uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- approve_organization / reject_organization: admin-only.
-- Rejecting does not delete the organisation row (preserves history/audit
-- trail); it sets is_approved = false with an admin note explaining why, so
-- the org can be corrected and resubmitted rather than losing all context.
-- ---------------------------------------------------------------------------
create or replace function public.approve_organization(
  p_org_id uuid,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_admin() then
    raise exception 'Only an admin can approve an organisation';
  end if;
  if not exists (select 1 from public.organizations where id = p_org_id) then
    raise exception 'Organisation not found';
  end if;

  update public.organizations
    set is_approved = true, verified_by = v_uid, admin_note = p_note
    where id = p_org_id;

  perform public.log_admin_action(
    'approve_organization', 'organizations', p_org_id,
    jsonb_build_object('note', p_note)
  );

  return p_org_id;
end;
$$;

create or replace function public.reject_organization(
  p_org_id uuid,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_admin() then
    raise exception 'Only an admin can reject an organisation';
  end if;
  if not exists (select 1 from public.organizations where id = p_org_id) then
    raise exception 'Organisation not found';
  end if;

  update public.organizations
    set is_approved = false, verified_by = v_uid, admin_note = p_note
    where id = p_org_id;

  perform public.log_admin_action(
    'reject_organization', 'organizations', p_org_id,
    jsonb_build_object('note', p_note)
  );

  return p_org_id;
end;
$$;

revoke all on function public.approve_organization(uuid, text) from public;
grant execute on function public.approve_organization(uuid, text) to authenticated;
revoke all on function public.reject_organization(uuid, text) from public;
grant execute on function public.reject_organization(uuid, text) to authenticated;


-- ---------------------------------------------------------------------------
-- hide_comment / unhide_comment: admin-only. Sets is_hidden and logs the
-- action explicitly (in addition to whatever the comments table's own RLS
-- would allow — is_hidden is already admin-writable per comments_moderate,
-- but going through this RPC guarantees an audit_logs row every time, since
-- comments has no audit trigger).
-- ---------------------------------------------------------------------------
create or replace function public.hide_comment(p_comment_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_admin() then
    raise exception 'Only an admin can hide a comment';
  end if;
  if not exists (select 1 from public.comments where id = p_comment_id) then
    raise exception 'Comment not found';
  end if;

  update public.comments set is_hidden = true where id = p_comment_id;

  perform public.log_admin_action(
    'hide_comment', 'comments', p_comment_id, jsonb_build_object('reason', p_reason)
  );

  return p_comment_id;
end;
$$;

create or replace function public.unhide_comment(p_comment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_admin() then
    raise exception 'Only an admin can unhide a comment';
  end if;
  if not exists (select 1 from public.comments where id = p_comment_id) then
    raise exception 'Comment not found';
  end if;

  update public.comments set is_hidden = false where id = p_comment_id;

  perform public.log_admin_action('unhide_comment', 'comments', p_comment_id, '{}'::jsonb);

  return p_comment_id;
end;
$$;

revoke all on function public.hide_comment(uuid, text) from public;
grant execute on function public.hide_comment(uuid, text) to authenticated;
revoke all on function public.unhide_comment(uuid) from public;
grant execute on function public.unhide_comment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- review_moderation_flag: admin-only. Actions:
--   'dismiss'    -> status = 'dismissed', no side effect on the target.
--   'resolve'    -> status = 'resolved', no side effect on the target.
--   'hide_comment' -> status = 'resolved' AND hides the target comment
--                     (target_type must be 'comment').
--   'close_case' -> status = 'resolved' AND closes the case associated with
--                   the target cat (target_type must be 'cat'; finds the
--                   cat's most recent case).
-- Every action writes one audit_logs row summarising the flag and the
-- action taken.
-- ---------------------------------------------------------------------------
create or replace function public.review_moderation_flag(
  p_flag_id uuid,
  p_action text,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_flag public.moderation_flags%rowtype;
  v_case_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_admin() then
    raise exception 'Only an admin can review a moderation flag';
  end if;
  if p_action not in ('dismiss', 'resolve', 'hide_comment', 'close_case') then
    raise exception 'Invalid moderation action';
  end if;

  select * into v_flag from public.moderation_flags where id = p_flag_id;
  if not found then
    raise exception 'Moderation flag not found';
  end if;

  if p_action = 'hide_comment' then
    if v_flag.target_type <> 'comment' then
      raise exception 'hide_comment action requires a comment-type flag';
    end if;
    update public.comments set is_hidden = true where id = v_flag.target_id;
  elsif p_action = 'close_case' then
    if v_flag.target_type <> 'cat' then
      raise exception 'close_case action requires a cat-type flag';
    end if;
    select id into v_case_id from public.cases
      where cat_id = v_flag.target_id order by opened_at desc limit 1;
    if v_case_id is not null then
      update public.cases set status = 'closed', closed_at = now() where id = v_case_id;
      insert into public.case_events (case_id, type, actor_id, payload)
        values (v_case_id, 'case_closed', v_uid,
                jsonb_build_object('message', 'Case closed following a moderation review', 'flag_id', p_flag_id));
    end if;
  end if;

  update public.moderation_flags
    set status = case when p_action = 'dismiss' then 'dismissed' else 'resolved' end,
        resolved_by = v_uid,
        resolved_at = now(),
        resolution_note = p_note
    where id = p_flag_id;

  perform public.log_admin_action(
    'review_moderation_flag', 'moderation_flags', p_flag_id,
    jsonb_build_object(
      'action', p_action, 'note', p_note,
      'target_type', v_flag.target_type, 'target_id', v_flag.target_id
    )
  );

  return p_flag_id;
end;
$$;

revoke all on function public.review_moderation_flag(uuid, text, text) from public;
grant execute on function public.review_moderation_flag(uuid, text, text) to authenticated;


-- ---------------------------------------------------------------------------
-- Case governance RPCs. Each requires admin OR has_case_access (the claimed
-- volunteer or the case's own org member) — broader than admin-only, per the
-- spec's "Admins and authorised orgs should be able to..." requirement.
-- Every action appends a case_events row and an audit_logs row.
-- ---------------------------------------------------------------------------

-- close_case: sets status='closed'. Refuses to "close" a case that is
-- already a terminal outcome the wrong way round is not a concern here
-- (closing an adopted/released case is a legitimate governance action, e.g.
-- to formally end coordination) — but closing NEVER happens silently as a
-- side effect of something else without an explicit case_events entry.
create or replace function public.close_case(p_case_id uuid, p_note text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.is_admin() and not public.has_case_access(p_case_id) then
    raise exception 'You do not have access to close this case';
  end if;
  if not exists (select 1 from public.cases where id = p_case_id) then
    raise exception 'Case not found';
  end if;

  update public.cases set status = 'closed', closed_at = now() where id = p_case_id;

  insert into public.case_events (case_id, type, actor_id, payload)
    values (p_case_id, 'case_closed', v_uid, jsonb_build_object('message', coalesce(p_note, 'Case closed')));

  perform public.log_admin_action('close_case', 'cases', p_case_id, jsonb_build_object('note', p_note));

  return p_case_id;
end;
$$;

-- reopen_case: only safe from 'closed' or 'archived' — refuses to reopen a
-- case whose cat has reached a genuinely resolved outcome (adopted/released)
-- to avoid contradicting that outcome; an admin who really needs to correct
-- a mistaken adoption/release should fix the underlying adoption/TNR record
-- first, which will naturally update the case status through those RPCs.
create or replace function public.reopen_case(p_case_id uuid, p_note text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_case public.cases%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.is_admin() and not public.has_case_access(p_case_id) then
    raise exception 'You do not have access to reopen this case';
  end if;

  select * into v_case from public.cases where id = p_case_id;
  if not found then raise exception 'Case not found'; end if;

  if v_case.status not in ('closed', 'archived') then
    raise exception 'Only a closed or archived case can be reopened';
  end if;

  update public.cases set status = 'active', closed_at = null where id = p_case_id;

  insert into public.case_events (case_id, type, actor_id, payload)
    values (p_case_id, 'case_reopened', v_uid, jsonb_build_object('message', coalesce(p_note, 'Case reopened')));

  perform public.log_admin_action('reopen_case', 'cases', p_case_id, jsonb_build_object('note', p_note));

  return p_case_id;
end;
$$;

-- archive_case: admin/authorised-carer only, sets status='archived'. Unlike
-- close_case, archiving is intended for stale/duplicate/no-longer-actionable
-- cases rather than a resolved outcome.
create or replace function public.archive_case(p_case_id uuid, p_note text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.is_admin() and not public.has_case_access(p_case_id) then
    raise exception 'You do not have access to archive this case';
  end if;
  if not exists (select 1 from public.cases where id = p_case_id) then
    raise exception 'Case not found';
  end if;

  update public.cases set status = 'archived', closed_at = now() where id = p_case_id;

  insert into public.case_events (case_id, type, actor_id, payload)
    values (p_case_id, 'case_archived', v_uid, jsonb_build_object('message', coalesce(p_note, 'Case archived')));

  perform public.log_admin_action('archive_case', 'cases', p_case_id, jsonb_build_object('note', p_note));

  return p_case_id;
end;
$$;

-- reassign_case: admin or an org member of the case's own org may reassign a
-- claimed (or unclaimed) case to a specific volunteer. The target must be an
-- approved volunteer/org/admin profile.
create or replace function public.reassign_case(p_case_id uuid, p_new_claimed_by uuid, p_note text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_case public.cases%rowtype;
  v_target_role user_role;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_case from public.cases where id = p_case_id;
  if not found then raise exception 'Case not found'; end if;

  if not public.is_admin()
     and not (v_case.org_id is not null and v_case.org_id = (select org_id from public.profiles where id = v_uid)) then
    raise exception 'Only an admin or a member of this case''s organisation can reassign it';
  end if;

  select role into v_target_role from public.profiles where id = p_new_claimed_by;
  if v_target_role is null then
    raise exception 'Target user not found';
  end if;
  if v_target_role not in ('volunteer', 'org', 'admin') then
    raise exception 'Cases can only be assigned to a volunteer, organisation member, or admin';
  end if;

  update public.cases
    set claimed_by = p_new_claimed_by,
        status = case when status = 'reported' then 'active'::case_status else status end
    where id = p_case_id;

  insert into public.case_events (case_id, type, actor_id, payload)
    values (p_case_id, 'case_reassigned', v_uid,
            jsonb_build_object('message', coalesce(p_note, 'Case reassigned to another volunteer'), 'new_claimed_by', p_new_claimed_by));

  perform public.log_admin_action(
    'reassign_case', 'cases', p_case_id,
    jsonb_build_object('previous_claimed_by', v_case.claimed_by, 'new_claimed_by', p_new_claimed_by, 'note', p_note)
  );

  return p_case_id;
end;
$$;

-- release_claim: the claiming volunteer (or admin/org) voluntarily releases
-- their claim, returning the case to the unclaimed pool.
create or replace function public.release_claim(p_case_id uuid, p_note text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_case public.cases%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_case from public.cases where id = p_case_id;
  if not found then raise exception 'Case not found'; end if;

  if not public.is_admin() and v_case.claimed_by <> v_uid then
    raise exception 'Only the volunteer who claimed this case (or an admin) can release the claim';
  end if;

  update public.cases set claimed_by = null where id = p_case_id;

  insert into public.case_events (case_id, type, actor_id, payload)
    values (p_case_id, 'claim_released', v_uid, jsonb_build_object('message', coalesce(p_note, 'Volunteer released their claim')));

  perform public.log_admin_action('release_claim', 'cases', p_case_id, jsonb_build_object('note', p_note));

  return p_case_id;
end;
$$;

revoke all on function public.close_case(uuid, text) from public;
grant execute on function public.close_case(uuid, text) to authenticated;
revoke all on function public.reopen_case(uuid, text) from public;
grant execute on function public.reopen_case(uuid, text) to authenticated;
revoke all on function public.archive_case(uuid, text) from public;
grant execute on function public.archive_case(uuid, text) to authenticated;
revoke all on function public.reassign_case(uuid, uuid, text) from public;
grant execute on function public.reassign_case(uuid, uuid, text) to authenticated;
revoke all on function public.release_claim(uuid, text) from public;
grant execute on function public.release_claim(uuid, text) to authenticated;


-- ---------------------------------------------------------------------------
-- Patch claim_case (originally defined in migration 0009) to also require
-- the caller's profile to be approved. An unapproved volunteer/org account
-- should not be able to claim cases even by calling the RPC directly —
-- previously only the role was checked. Re-created in full since Postgres
-- does not support partial function bodies.
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
  v_approved boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if v_role not in ('volunteer', 'org', 'admin') then
    raise exception 'Only volunteers, organisations, or admins can claim a case';
  end if;

  select is_approved into v_approved from public.profiles where id = v_uid;
  if v_role <> 'admin' and coalesce(v_approved, false) = false then
    raise exception 'Your account is pending admin approval and cannot claim cases yet';
  end if;

  select * into v_case from public.cases where id = p_case_id;
  if not found then
    raise exception 'Case not found';
  end if;

  if v_case.claimed_by is not null and v_case.claimed_by <> v_uid then
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

grant execute on function public.claim_case(uuid) to authenticated;
