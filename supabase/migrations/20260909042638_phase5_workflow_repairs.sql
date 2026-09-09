-- Phase 5 P2 workflow repairs: correction/resubmission, least-privilege
-- contributor edits, duplicate review signals, admin link-field alignment,
-- and minimal weekly recurrence.

begin;

-- Durable correction/resubmission states plus timestamps. Correction reasons
-- remain in review_verification_evidence and audit_events.
alter table public.opportunities drop constraint if exists opportunities_status_check;
alter table public.events drop constraint if exists events_status_check;
alter table public.announcements drop constraint if exists announcements_status_check;

alter table public.opportunities add constraint opportunities_status_check
  check (status in ('pending','needs_correction','resubmitted','published','rejected','unpublished','archived','deleted'));
alter table public.events add constraint events_status_check
  check (status in ('pending','needs_correction','resubmitted','published','rejected','unpublished','archived','deleted'));
alter table public.announcements add constraint announcements_status_check
  check (status in ('pending','needs_correction','resubmitted','published','rejected','unpublished','archived','deleted'));

alter table public.opportunities
  add column if not exists correction_requested_at timestamptz,
  add column if not exists resubmitted_at timestamptz,
  add column if not exists possible_duplicate boolean not null default false,
  add column if not exists duplicate_of uuid references public.opportunities(id) on delete set null;
alter table public.events
  add column if not exists correction_requested_at timestamptz,
  add column if not exists resubmitted_at timestamptz,
  add column if not exists possible_duplicate boolean not null default false,
  add column if not exists duplicate_of uuid references public.events(id) on delete set null,
  add column if not exists recurrence_type text,
  add column if not exists recurrence_weekday smallint,
  add column if not exists recurrence_start_date date,
  add column if not exists recurrence_end_date date,
  add column if not exists recurrence_start_time time,
  add column if not exists recurrence_end_time time;
alter table public.announcements
  add column if not exists correction_requested_at timestamptz,
  add column if not exists resubmitted_at timestamptz,
  add column if not exists possible_duplicate boolean not null default false,
  add column if not exists duplicate_of uuid references public.announcements(id) on delete set null;

alter table public.events drop constraint if exists events_recurrence_type_check;
alter table public.events add constraint events_recurrence_type_check
  check (recurrence_type is null or recurrence_type = 'weekly');
alter table public.events drop constraint if exists events_weekly_recurrence_fields_check;
alter table public.events add constraint events_weekly_recurrence_fields_check check (
  (recurrence_type is null and recurrence_weekday is null and recurrence_start_date is null
    and recurrence_end_date is null and recurrence_start_time is null and recurrence_end_time is null)
  or
  (recurrence_type = 'weekly' and recurrence_weekday between 0 and 6
    and recurrence_start_date is not null and recurrence_end_date is not null
    and recurrence_start_time is not null and recurrence_end_time is not null
    and recurrence_start_date <= recurrence_end_date
    and recurrence_start_time < recurrence_end_time
    and extract(dow from recurrence_start_date)::smallint = recurrence_weekday)
);

create index if not exists opportunities_duplicate_review_idx
  on public.opportunities (possible_duplicate) where possible_duplicate;
create index if not exists events_duplicate_review_idx
  on public.events (possible_duplicate) where possible_duplicate;
create index if not exists announcements_duplicate_review_idx
  on public.announcements (possible_duplicate) where possible_duplicate;

create or replace function public.normalize_duplicate_text(p_value text)
returns text language sql immutable parallel safe set search_path=pg_catalog as $$
  select lower(regexp_replace(trim(coalesce(p_value, '')), '\s+', ' ', 'g'));
$$;

create or replace function public.normalize_duplicate_link(p_value text)
returns text language sql immutable parallel safe set search_path=pg_catalog as $$
  select regexp_replace(lower(split_part(trim(coalesce(p_value, '')), '#', 1)), '/+$', '');
$$;

create or replace function public.flag_possible_duplicate()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare
  candidate uuid;
  link_column text;
  link_value text;
begin
  link_column := case tg_table_name
    when 'opportunities' then 'link'
    when 'events' then 'registration_link'
    when 'announcements' then 'source_url'
  end;
  link_value := public.normalize_duplicate_link(to_jsonb(new)->>link_column);

  if public.normalize_duplicate_text(new.title) = '' or link_value = '' then
    new.possible_duplicate := false;
    new.duplicate_of := null;
    return new;
  end if;

  execute format(
    'select id from public.%I where id <> $1 and status <> ''deleted'' and public.normalize_duplicate_text(title) = $2 and public.normalize_duplicate_link(%I) = $3 order by created_at, id limit 1',
    tg_table_name,
    link_column
  ) into candidate using new.id, public.normalize_duplicate_text(new.title), link_value;

  new.possible_duplicate := candidate is not null;
  new.duplicate_of := candidate;
  return new;
end
$$;

drop trigger if exists opportunities_duplicate_flag on public.opportunities;
drop trigger if exists events_duplicate_flag on public.events;
drop trigger if exists announcements_duplicate_flag on public.announcements;
create trigger opportunities_duplicate_flag before insert or update of title,link on public.opportunities
  for each row execute function public.flag_possible_duplicate();
create trigger events_duplicate_flag before insert or update of title,registration_link on public.events
  for each row execute function public.flag_possible_duplicate();
create trigger announcements_duplicate_flag before insert or update of title,source_url on public.announcements
  for each row execute function public.flag_possible_duplicate();

-- Contributor edits are column-scoped and row-scoped. System fields including
-- status, ownership, evidence, verification, and duplicate flags are excluded.
grant update (
  title,org,type,paid,majors,classifications,work_mode,compensation_type,
  description,eligibility,deadline,location,link,contact_name,contact_email,
  contact_linkedin,flyer_url
) on public.opportunities to authenticated;
grant update (
  title,type,majors,description,date,time,location,registration_link,
  presenter_name,presenter_affiliation,is_alumni_presenter,is_sponsor_presenter,
  contact_name,contact_email,org,flyer_url,recurrence_type,recurrence_weekday,
  recurrence_start_date,recurrence_end_date,recurrence_start_time,recurrence_end_time
) on public.events to authenticated;
grant update (source,title,body,category,source_url) on public.announcements to authenticated;

drop policy if exists "contributors edit own returned opportunities" on public.opportunities;
drop policy if exists "contributors edit own returned events" on public.events;
drop policy if exists "contributors edit own returned announcements" on public.announcements;
create policy "contributors edit own returned opportunities" on public.opportunities
  for update to authenticated
  using (public.is_verified_contributor() and status='needs_correction' and submitted_by in (
    select id from public.user_roles where auth_user_id=auth.uid() and status='active'))
  with check (public.is_verified_contributor() and status='needs_correction' and submitted_by in (
    select id from public.user_roles where auth_user_id=auth.uid() and status='active'));
create policy "contributors edit own returned events" on public.events
  for update to authenticated
  using (public.is_verified_contributor() and status='needs_correction' and submitted_by in (
    select id from public.user_roles where auth_user_id=auth.uid() and status='active'))
  with check (public.is_verified_contributor() and status='needs_correction' and submitted_by in (
    select id from public.user_roles where auth_user_id=auth.uid() and status='active'));
create policy "contributors edit own returned announcements" on public.announcements
  for update to authenticated
  using (public.is_verified_contributor() and status='needs_correction' and submitted_by in (
    select id from public.user_roles where auth_user_id=auth.uid() and status='active'))
  with check (public.is_verified_contributor() and status='needs_correction' and submitted_by in (
    select id from public.user_roles where auth_user_id=auth.uid() and status='active'));

create or replace function public.request_review_correction(
  p_content_type text,
  p_content_id uuid,
  p_reason text
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor public.user_roles;
  table_name text;
  current_status text;
  target_submitter_id uuid;
  evidence_id uuid;
begin
  if not public.is_reviewer() then raise exception 'Reviewer access required'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'Correction reason required'; end if;
  if p_content_type not in ('opportunity','event','announcement') then raise exception 'Invalid content type'; end if;

  select * into actor from public.user_roles
    where auth_user_id=auth.uid() and status='active' for update;
  table_name := case p_content_type when 'opportunity' then 'opportunities' when 'event' then 'events' else 'announcements' end;
  execute format('select status,submitted_by from public.%I where id=$1 for update',table_name)
    into current_status,target_submitter_id using p_content_id;
  if current_status is null then raise exception 'Content not found'; end if;
  if target_submitter_id=actor.id then raise exception 'Reviewers cannot review or modify review evidence for their own submission'; end if;
  if current_status not in ('pending','resubmitted') then raise exception 'Only pending or resubmitted content can receive a correction request'; end if;

  insert into public.review_verification_evidence(
    content_type,content_id,reviewer_role_id,reviewer_notes,decision,completed_at,updated_at
  ) values (p_content_type,p_content_id,actor.id,nullif(trim(p_reason),''),'needs_correction',now(),now())
  on conflict(content_type,content_id,reviewer_role_id) do update set
    reviewer_notes=excluded.reviewer_notes,decision='needs_correction',completed_at=now(),updated_at=now()
  returning id into evidence_id;

  execute format('update public.%I set status=''needs_correction'',correction_requested_at=now() where id=$1',table_name)
    using p_content_id;
  insert into public.audit_events(content_type,content_id,actor_type,actor_id,action,previous_status,new_status,reason,changes)
  values(p_content_type,p_content_id,'reviewer',actor.id,'review_correction_requested',current_status,'needs_correction',nullif(trim(p_reason),''),jsonb_build_object('decision','needs_correction','evidence_id',evidence_id));
  return jsonb_build_object('ok',true,'evidence_id',evidence_id,'status','needs_correction');
end
$$;
revoke all on function public.request_review_correction(text,uuid,text) from public,anon;
grant execute on function public.request_review_correction(text,uuid,text) to authenticated;

create or replace function public.resubmit_corrected_content(p_content_type text,p_content_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor public.user_roles;
  table_name text;
  current_status text;
  target_submitter_id uuid;
begin
  if not public.is_verified_contributor() then raise exception 'Contributor access required'; end if;
  if p_content_type not in ('opportunity','event','announcement') then raise exception 'Invalid content type'; end if;
  select * into actor from public.user_roles where auth_user_id=auth.uid() and status='active' for update;
  table_name := case p_content_type when 'opportunity' then 'opportunities' when 'event' then 'events' else 'announcements' end;
  execute format('select status,submitted_by from public.%I where id=$1 for update',table_name)
    into current_status,target_submitter_id using p_content_id;
  if current_status is null then raise exception 'Content not found'; end if;
  if target_submitter_id<>actor.id then raise exception 'Only the original submitter may resubmit content'; end if;
  if current_status<>'needs_correction' then raise exception 'Only corrected content may be resubmitted'; end if;

  execute format('update public.%I set status=''resubmitted'',resubmitted_at=now() where id=$1',table_name)
    using p_content_id;
  update public.review_verification_evidence set
    official_source_opened=false,primary_link_checked=false,essential_facts_verified=false,
    contact_organization_verified=false,safe_content_confirmed=false,
    decision='in_review',completed_at=null,updated_at=now()
  where content_type=p_content_type and content_id=p_content_id;
  insert into public.audit_events(content_type,content_id,actor_type,actor_id,action,previous_status,new_status,changes)
  values(p_content_type,p_content_id,'contributor',actor.id,'content_resubmitted','needs_correction','resubmitted',jsonb_build_object('resubmitted_at',now()));
  return jsonb_build_object('ok',true,'status','resubmitted','content_type',p_content_type,'content_id',p_content_id);
end
$$;
revoke all on function public.resubmit_corrected_content(text,uuid) from public,anon;
grant execute on function public.resubmit_corrected_content(text,uuid) to authenticated;

-- Accept resubmitted rows as pending review, but require fresh complete evidence.
create or replace function public.review_content(p_content_type text,p_content_id uuid,p_decision text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare table_name text; current_status text; target_submitter_id uuid; actor public.user_roles; evidence public.review_verification_evidence;
begin
  if not public.is_reviewer() then raise exception 'Reviewer access required'; end if;
  if p_decision not in ('published','rejected') then raise exception 'Invalid review decision'; end if;
  if p_decision='rejected' and nullif(trim(p_reason),'') is null then raise exception 'Rejection reason required'; end if;
  table_name:=case p_content_type when 'opportunity' then 'opportunities' when 'event' then 'events' when 'announcement' then 'announcements' end;
  if table_name is null then raise exception 'Invalid content type'; end if;
  select * into actor from public.user_roles where auth_user_id=auth.uid() and status='active' for update;
  execute format('select status,submitted_by from public.%I where id=$1 for update',table_name) into current_status,target_submitter_id using p_content_id;
  if current_status is null then raise exception 'Content not found'; end if;
  if target_submitter_id=actor.id then raise exception 'Reviewers cannot review or modify review evidence for their own submission'; end if;
  if current_status not in ('pending','resubmitted') then raise exception 'Only pending or resubmitted content can be reviewed'; end if;
  select * into evidence from public.review_verification_evidence
    where content_type=p_content_type and content_id=p_content_id and reviewer_role_id=actor.id
    order by updated_at desc limit 1;
  if p_decision='published' and (evidence.id is null or not (evidence.official_source_opened and evidence.primary_link_checked and evidence.essential_facts_verified and evidence.contact_organization_verified and evidence.safe_content_confirmed)) then
    raise exception 'Complete all required verification items before publishing';
  end if;
  execute format('update public.%I set status=$1 where id=$2',table_name) using p_decision,p_content_id;
  update public.review_verification_evidence set decision=case when p_decision='published' then 'approved' else 'rejected' end,
    reviewer_notes=coalesce(nullif(trim(p_reason),''),reviewer_notes),completed_at=now(),updated_at=now() where id=evidence.id;
  insert into public.audit_events(content_type,content_id,actor_type,actor_id,action,previous_status,new_status,reason,changes)
  values(p_content_type,p_content_id,'reviewer',actor.id,'review_'||p_decision,current_status,p_decision,nullif(trim(p_reason),''),'{}'::jsonb);
  return jsonb_build_object('ok',true,'status',p_decision,'content_type',p_content_type,'content_id',p_content_id);
end
$$;
revoke all on function public.review_content(text,uuid,text,text) from public,anon;
grant execute on function public.review_content(text,uuid,text,text) to authenticated;

-- Correct the generic UI's source_url payload to each canonical link column.
create or replace function public.manage_published_content(p_content_type text,p_content_id uuid,p_action text,p_changes jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t text; current_status text; actor public.user_roles; prior text;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if p_action not in ('edit','unpublish','archive','soft_delete','restore') then raise exception 'Invalid content action'; end if;
  t:=case p_content_type when 'opportunity' then 'opportunities' when 'event' then 'events' when 'announcement' then 'announcements' end;
  if t is null then raise exception 'Invalid content type'; end if;
  execute format('select status from public.%I where id=$1 for update',t) into current_status using p_content_id;
  if current_status is null then raise exception 'Content not found'; end if;
  select * into actor from public.user_roles where auth_user_id=auth.uid() and status='active';
  if p_action='edit' then
    if current_status='deleted' then raise exception 'Restore deleted content before editing'; end if;
    if p_content_type='announcement' then
      update public.announcements set title=case when p_changes?'title' then left(trim(p_changes->>'title'),240) else title end,body=case when p_changes?'description' then left(trim(p_changes->>'description'),5000) else body end,source=case when p_changes?'organization' then left(trim(p_changes->>'organization'),240) else source end where id=p_content_id;
    elsif p_content_type='event' then
      update public.events set title=case when p_changes?'title' then left(trim(p_changes->>'title'),240) else title end,description=case when p_changes?'description' then left(trim(p_changes->>'description'),5000) else description end,org=case when p_changes?'organization' then left(trim(p_changes->>'organization'),240) else org end,registration_link=case when p_changes?'source_url' then nullif(left(trim(p_changes->>'source_url'),2000),'') else registration_link end where id=p_content_id;
    else
      update public.opportunities set title=case when p_changes?'title' then left(trim(p_changes->>'title'),240) else title end,description=case when p_changes?'description' then left(trim(p_changes->>'description'),5000) else description end,org=case when p_changes?'organization' then left(trim(p_changes->>'organization'),240) else org end,link=case when p_changes?'source_url' then nullif(left(trim(p_changes->>'source_url'),2000),'') else link end where id=p_content_id;
    end if;
  elsif p_action='unpublish' then
    if current_status<>'published' then raise exception 'Only published content can be unpublished'; end if;
    execute format('update public.%I set status=''unpublished'' where id=$1',t) using p_content_id;
  elsif p_action='archive' then
    if current_status not in ('published','unpublished') then raise exception 'Only published or unpublished content can be archived'; end if;
    execute format('update public.%I set status=''archived'' where id=$1',t) using p_content_id;
  elsif p_action='soft_delete' then
    if current_status='deleted' then raise exception 'Content is already deleted'; end if;
    execute format('update public.%I set deleted_previous_status=status,status=''deleted'',deleted_at=now(),deleted_by=$1 where id=$2',t) using actor.id,p_content_id;
  else
    if current_status<>'deleted' then raise exception 'Only deleted content can be restored'; end if;
    execute format('select coalesce(deleted_previous_status,''unpublished'') from public.%I where id=$1',t) into prior using p_content_id;
    execute format('update public.%I set status=$1,deleted_at=null,deleted_by=null,deleted_previous_status=null where id=$2',t) using prior,p_content_id;
  end if;
  insert into public.audit_events(content_type,content_id,actor_type,actor_id,action,previous_status,new_status,changes)
    values(p_content_type,p_content_id,'administrator',actor.id,'content_'||p_action,current_status,case when p_action='edit' then current_status when p_action='unpublish' then 'unpublished' when p_action='archive' then 'archived' when p_action='soft_delete' then 'deleted' else prior end,case when p_action='edit' then p_changes else '{}'::jsonb end);
  return jsonb_build_object('ok',true,'action',p_action,'content_id',p_content_id);
end
$$;
revoke all on function public.manage_published_content(text,uuid,text,jsonb) from public,anon;
grant execute on function public.manage_published_content(text,uuid,text,jsonb) to authenticated;

commit;
