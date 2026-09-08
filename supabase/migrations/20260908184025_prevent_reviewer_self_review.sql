begin;

create or replace function public.record_review_evidence(
  p_content_type text,
  p_content_id uuid,
  p_official_source_opened boolean,
  p_primary_link_checked boolean,
  p_essential_facts_verified boolean,
  p_contact_organization_verified boolean,
  p_safe_content_confirmed boolean,
  p_reviewer_notes text default null,
  p_decision text default 'in_review'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor public.user_roles;
  table_name text;
  current_status text;
  target_submitter_id uuid;
  evidence public.review_verification_evidence;
begin
  if not public.is_reviewer() then
    raise exception 'Reviewer access required';
  end if;
  if p_content_type not in ('opportunity', 'event', 'announcement') then
    raise exception 'Invalid content type';
  end if;
  if p_decision not in ('in_review', 'needs_correction', 'rejected', 'approved') then
    raise exception 'Invalid evidence decision';
  end if;

  select * into actor
  from public.user_roles
  where auth_user_id = auth.uid() and status = 'active'
  for update;

  table_name := case p_content_type
    when 'opportunity' then 'opportunities'
    when 'event' then 'events'
    else 'announcements'
  end;

  execute format(
    'select status, submitted_by from public.%I where id = $1',
    table_name
  ) into current_status, target_submitter_id using p_content_id;

  if current_status is null then
    raise exception 'Content not found';
  end if;
  if target_submitter_id = actor.id then
    raise exception 'Reviewers cannot review or modify review evidence for their own submission';
  end if;

  insert into public.review_verification_evidence(
    content_type,
    content_id,
    reviewer_role_id,
    official_source_opened,
    primary_link_checked,
    essential_facts_verified,
    contact_organization_verified,
    safe_content_confirmed,
    reviewer_notes,
    decision,
    completed_at,
    updated_at
  ) values (
    p_content_type,
    p_content_id,
    actor.id,
    p_official_source_opened,
    p_primary_link_checked,
    p_essential_facts_verified,
    p_contact_organization_verified,
    p_safe_content_confirmed,
    nullif(trim(p_reviewer_notes), ''),
    p_decision,
    case when p_decision in ('approved', 'rejected', 'needs_correction') then now() else null end,
    now()
  )
  on conflict(content_type, content_id, reviewer_role_id) do update set
    official_source_opened = excluded.official_source_opened,
    primary_link_checked = excluded.primary_link_checked,
    essential_facts_verified = excluded.essential_facts_verified,
    contact_organization_verified = excluded.contact_organization_verified,
    safe_content_confirmed = excluded.safe_content_confirmed,
    reviewer_notes = excluded.reviewer_notes,
    decision = excluded.decision,
    completed_at = excluded.completed_at,
    updated_at = now()
  returning * into evidence;

  return jsonb_build_object(
    'ok', true,
    'evidence_id', evidence.id,
    'complete', evidence.official_source_opened
      and evidence.primary_link_checked
      and evidence.essential_facts_verified
      and evidence.contact_organization_verified
      and evidence.safe_content_confirmed
  );
end
$$;

revoke all on function public.record_review_evidence(text, uuid, boolean, boolean, boolean, boolean, boolean, text, text) from public, anon;
grant execute on function public.record_review_evidence(text, uuid, boolean, boolean, boolean, boolean, boolean, text, text) to authenticated;

create or replace function public.review_content(
  p_content_type text,
  p_content_id uuid,
  p_decision text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  table_name text;
  current_status text;
  target_submitter_id uuid;
  actor public.user_roles;
  evidence public.review_verification_evidence;
begin
  if not public.is_reviewer() then
    raise exception 'Reviewer access required';
  end if;
  if p_decision not in ('published', 'rejected') then
    raise exception 'Invalid review decision';
  end if;
  if p_decision = 'rejected' and nullif(trim(p_reason), '') is null then
    raise exception 'Rejection reason required';
  end if;

  table_name := case p_content_type
    when 'opportunity' then 'opportunities'
    when 'event' then 'events'
    when 'announcement' then 'announcements'
    else null
  end;
  if table_name is null then
    raise exception 'Invalid content type';
  end if;

  select * into actor
  from public.user_roles
  where auth_user_id = auth.uid() and status = 'active'
  for update;

  execute format(
    'select status, submitted_by from public.%I where id = $1 for update',
    table_name
  ) into current_status, target_submitter_id using p_content_id;

  if current_status is null then
    raise exception 'Content not found';
  end if;
  if target_submitter_id = actor.id then
    raise exception 'Reviewers cannot review or modify review evidence for their own submission';
  end if;
  if current_status <> 'pending' then
    raise exception 'Only pending content can be reviewed';
  end if;

  select * into evidence
  from public.review_verification_evidence
  where content_type = p_content_type
    and content_id = p_content_id
    and reviewer_role_id in (
      select id from public.user_roles
      where auth_user_id = auth.uid() and status = 'active'
    )
  order by updated_at desc
  limit 1;

  if p_decision = 'published' and (
    evidence.id is null
    or not (
      evidence.official_source_opened
      and evidence.primary_link_checked
      and evidence.essential_facts_verified
      and evidence.contact_organization_verified
      and evidence.safe_content_confirmed
    )
  ) then
    raise exception 'Complete all required verification items before publishing';
  end if;

  execute format('update public.%I set status = $1 where id = $2', table_name)
    using p_decision, p_content_id;

  update public.review_verification_evidence
  set decision = case when p_decision = 'published' then 'approved' else 'rejected' end,
      reviewer_notes = coalesce(nullif(trim(p_reason), ''), reviewer_notes),
      completed_at = now(),
      updated_at = now()
  where id = evidence.id;

  update public.audit_events
  set reason = nullif(trim(p_reason), '')
  where id = (
    select id from public.audit_events
    where content_type = p_content_type
      and content_id = p_content_id
      and actor_id = actor.id
      and new_status = p_decision
    order by created_at desc
    limit 1
  );

  return jsonb_build_object(
    'ok', true,
    'status', p_decision,
    'content_type', p_content_type,
    'content_id', p_content_id
  );
end
$$;

revoke all on function public.review_content(text, uuid, text, text) from public, anon;
grant execute on function public.review_content(text, uuid, text, text) to authenticated;

create or replace function public.request_review_correction(
  p_content_type text,
  p_content_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor public.user_roles;
  table_name text;
  current_status text;
  target_submitter_id uuid;
  evidence_id uuid;
begin
  if not public.is_reviewer() then
    raise exception 'Reviewer access required';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'Correction reason required';
  end if;
  if p_content_type not in ('opportunity', 'event', 'announcement') then
    raise exception 'Invalid content type';
  end if;

  select * into actor
  from public.user_roles
  where auth_user_id = auth.uid() and status = 'active'
  for update;

  table_name := case p_content_type
    when 'opportunity' then 'opportunities'
    when 'event' then 'events'
    else 'announcements'
  end;

  execute format(
    'select status, submitted_by from public.%I where id = $1',
    table_name
  ) into current_status, target_submitter_id using p_content_id;

  if current_status is null then
    raise exception 'Content not found';
  end if;
  if target_submitter_id = actor.id then
    raise exception 'Reviewers cannot review or modify review evidence for their own submission';
  end if;
  if current_status <> 'pending' then
    raise exception 'Only pending content can receive a correction request';
  end if;

  insert into public.review_verification_evidence(
    content_type,
    content_id,
    reviewer_role_id,
    reviewer_notes,
    decision,
    completed_at,
    updated_at
  ) values (
    p_content_type,
    p_content_id,
    actor.id,
    nullif(trim(p_reason), ''),
    'needs_correction',
    now(),
    now()
  )
  on conflict(content_type, content_id, reviewer_role_id) do update set
    reviewer_notes = excluded.reviewer_notes,
    decision = 'needs_correction',
    completed_at = now(),
    updated_at = now()
  returning id into evidence_id;

  insert into public.audit_events(
    content_type,
    content_id,
    actor_type,
    actor_id,
    action,
    reason,
    changes
  ) values (
    p_content_type,
    p_content_id,
    'reviewer',
    actor.id,
    'review_correction_requested',
    nullif(trim(p_reason), ''),
    jsonb_build_object('decision', 'needs_correction', 'evidence_id', evidence_id)
  );

  return jsonb_build_object(
    'ok', true,
    'evidence_id', evidence_id,
    'status', 'needs_correction'
  );
end
$$;

revoke all on function public.request_review_correction(text, uuid, text) from public, anon;
grant execute on function public.request_review_correction(text, uuid, text) to authenticated;

commit;
