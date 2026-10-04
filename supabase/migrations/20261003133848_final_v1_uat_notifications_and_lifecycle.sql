begin;

-- Date-only Hub rules use the Prairie View business date. Absolute audit and
-- authentication timestamps remain timestamptz/UTC.
create or replace function public.hub_business_date()
returns date
language sql
stable
set search_path = pg_catalog
as $$ select (now() at time zone 'America/Chicago')::date $$;
revoke all on function public.hub_business_date() from public, anon;
grant execute on function public.hub_business_date() to authenticated;

-- Preserve stale submissions in history while removing them from the active
-- review queue.
alter table public.opportunities drop constraint if exists opportunities_status_check;
alter table public.events drop constraint if exists events_status_check;
alter table public.announcements drop constraint if exists announcements_status_check;
alter table public.opportunities add constraint opportunities_status_check check(status in ('pending','needs_correction','resubmitted','published','rejected','unpublished','archived','deleted','expired_before_review'));
alter table public.events add constraint events_status_check check(status in ('pending','needs_correction','resubmitted','published','rejected','unpublished','archived','deleted','expired_before_review'));
alter table public.announcements add constraint announcements_status_check check(status in ('pending','needs_correction','resubmitted','published','rejected','unpublished','archived','deleted','expired_before_review'));

create or replace function public.expire_stale_review_content()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare actor public.user_roles; event_count integer; opportunity_count integer;
begin
  if not public.is_reviewer() then raise exception 'Reviewer access required'; end if;
  select * into actor from public.user_roles where auth_user_id=auth.uid() and status='active' limit 1;

  with expired as (
    update public.events set status='expired_before_review'
    where status in ('pending','resubmitted') and coalesce(end_date,date) < public.hub_business_date()
    returning id
  ) select count(*) into event_count from expired;

  with expired as (
    update public.opportunities set status='expired_before_review'
    where status in ('pending','resubmitted') and deadline_type='specific_date' and deadline < public.hub_business_date()
    returning id
  ) select count(*) into opportunity_count from expired;

  insert into public.audit_events(content_type,actor_type,actor_id,action,changes)
  select 'system','system',actor.id,'stale_review_queue_sweep',jsonb_build_object('events_expired',event_count,'opportunities_expired',opportunity_count,'business_date',public.hub_business_date())
  where event_count + opportunity_count > 0;
  return jsonb_build_object('events_expired',event_count,'opportunities_expired',opportunity_count);
end;
$$;
revoke all on function public.expire_stale_review_content() from public, anon;
grant execute on function public.expire_stale_review_content() to authenticated;

create or replace function public.review_stale_apply_asap(p_opportunity_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare actor public.user_roles; prior public.opportunities;
begin
  if not public.is_reviewer() then raise exception 'Reviewer access required'; end if;
  if p_action not in ('continue_review','mark_closed') then raise exception 'Invalid availability action'; end if;
  select * into actor from public.user_roles where auth_user_id=auth.uid() and status='active' limit 1;
  select * into prior from public.opportunities where id=p_opportunity_id for update;
  if prior.id is null or prior.status not in ('pending','resubmitted') or prior.deadline_type <> 'rolling' then raise exception 'Pending Apply ASAP opportunity not found'; end if;
  if prior.submitted_by=actor.id then raise exception 'Reviewers cannot review their own submission'; end if;
  if p_action='mark_closed' then update public.opportunities set status='rejected' where id=prior.id; end if;
  insert into public.audit_events(content_type,content_id,actor_type,actor_id,action,previous_status,new_status,reason,changes)
  values('opportunity',prior.id,'reviewer',actor.id,'apply_asap_'||p_action,prior.status,case when p_action='mark_closed' then 'rejected' else prior.status end,case when p_action='mark_closed' then 'Source is no longer accepting applications.' else null end,jsonb_build_object('availability_checked_at',now()));
  return jsonb_build_object('ok',true,'status',case when p_action='mark_closed' then 'rejected' else prior.status end);
end;
$$;
revoke all on function public.review_stale_apply_asap(uuid,text) from public, anon;
grant execute on function public.review_stale_apply_asap(uuid,text) to authenticated;

-- Contributor feedback stays lightweight; only Super Admin can read aggregate
-- and detailed parser-quality data.
create or replace function public.save_intake_parser_feedback(p_intake_session_id uuid,p_rating text,p_issue_fields text[] default '{}',p_note text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor public.user_roles; owned_session public.intake_sessions; cleaned_issues text[];
begin
  select * into actor from public.user_roles where auth_user_id=auth.uid() and status='active' and role in ('contributor','reviewer','admin','super_admin') limit 1;
  if actor.id is null then raise exception 'Active contributor access required'; end if;
  select * into owned_session from public.intake_sessions where id=p_intake_session_id and submitter_id=actor.id and state='submitted';
  if owned_session.id is null then raise exception 'Submitted intake session not found'; end if;
  if p_rating not in ('accurate','minor_edits','major_edits','failed') then raise exception 'Invalid parser feedback rating'; end if;
  select coalesce(array_agg(distinct issue),'{}'::text[]) into cleaned_issues from unnest(coalesce(p_issue_fields,'{}'::text[])) issue
  where issue=any(array['title','date','time','location','organization','contact','deadline','source_link','description','other']::text[]);
  if cardinality(cleaned_issues)<>cardinality(coalesce(p_issue_fields,'{}'::text[])) then raise exception 'Invalid parser feedback issue field'; end if;
  insert into public.intake_parser_feedback(intake_session_id,rating,issue_fields,note)
  values(p_intake_session_id,p_rating,cleaned_issues,nullif(left(trim(coalesce(p_note,'')),500),''))
  on conflict(intake_session_id) do update set rating=excluded.rating,issue_fields=excluded.issue_fields,note=excluded.note,updated_at=now();
  return jsonb_build_object('ok',true);
end;
$$;
revoke all on function public.save_intake_parser_feedback(uuid,text,text[],text) from public, anon;
grant execute on function public.save_intake_parser_feedback(uuid,text,text[],text) to authenticated;

-- Controlled organization registry populated only through an audited admin
-- decision on an organization request.
create table if not exists public.approved_organizations (
  id uuid primary key default gen_random_uuid(), name text not null, organization_type text not null,
  contact_name text, contact_email text, official_website text, status text not null default 'active' check(status in ('active','inactive')),
  source_issue_id uuid unique references public.issue_reports(id), approved_by uuid not null references public.user_roles(id), approved_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists approved_organizations_name_unique on public.approved_organizations(lower(name));
alter table public.approved_organizations enable row level security;
create policy "contributors read active approved organizations" on public.approved_organizations for select to authenticated using(status='active' or public.is_admin());
revoke all on table public.approved_organizations from public, anon, authenticated;
grant select on table public.approved_organizations to authenticated;

alter table public.issue_reports add column if not exists resolution_outcome text check(resolution_outcome is null or resolution_outcome in ('approved','rejected','resolved'));
alter table public.issue_reports add column if not exists resolution_note text check(resolution_note is null or char_length(resolution_note)<=1000);
alter table public.issue_reports add column if not exists resolved_by uuid references public.user_roles(id);

drop policy if exists "super admins read issue reports" on public.issue_reports;
drop policy if exists "super admins update issue reports" on public.issue_reports;
create policy "admins read issue reports" on public.issue_reports for select to authenticated using(public.is_admin());
create policy "admins update issue reports" on public.issue_reports for update to authenticated using(public.is_admin()) with check(public.is_admin());

create or replace function public.review_organization_request(p_issue_id uuid,p_decision text,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor public.user_roles; request public.issue_reports; organization_id uuid;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'Invalid organization decision'; end if;
  select * into actor from public.user_roles where auth_user_id=auth.uid() and status='active' limit 1;
  select * into request from public.issue_reports where id=p_issue_id and issue_type='Organization addition request' for update;
  if request.id is null then raise exception 'Organization request not found'; end if;
  if request.status='resolved' then raise exception 'Organization request is already resolved'; end if;
  if p_decision='approved' then
    insert into public.approved_organizations(name,organization_type,contact_name,contact_email,official_website,source_issue_id,approved_by)
    values(trim(request.request_details->>'organization_name'),trim(request.request_details->>'organization_type'),nullif(trim(request.request_details->>'organization_contact_name'),''),nullif(trim(request.request_details->>'organization_contact_email'),''),nullif(trim(request.request_details->>'official_website'),''),request.id,actor.id)
    on conflict(source_issue_id) do update set status='active',updated_at=now() returning id into organization_id;
  end if;
  update public.issue_reports set status='resolved',resolved_at=now(),resolved_by=actor.id,resolution_outcome=p_decision,resolution_note=nullif(left(trim(coalesce(p_note,'')),1000),'') where id=request.id;
  insert into public.audit_events(content_type,actor_type,actor_id,action,reason,changes)
  values('system','administrator',actor.id,'organization_request_'||p_decision,nullif(left(trim(coalesce(p_note,'')),1000),''),jsonb_build_object('issue_id',request.id,'organization_id',organization_id,'organization_name',request.request_details->>'organization_name'));
  return jsonb_build_object('ok',true,'decision',p_decision,'organization_id',organization_id);
end;
$$;
revoke all on function public.review_organization_request(uuid,text,text) from public, anon;
grant execute on function public.review_organization_request(uuid,text,text) to authenticated;

-- Content-specific public report reasons.
alter table public.issue_reports drop constraint if exists issue_reports_issue_type_check;
alter table public.issue_reports add constraint issue_reports_issue_type_check check(issue_type in (
  'Broken link','Wrong date/deadline','Wrong information','Duplicate','Event canceled/changed','Organization addition request','Sign-in issue','Submission issue','Calendar/display issue','Page error','Accessibility issue','Other',
  'Application link does not work','Opportunity expired / no longer available','Information is incorrect','Registration/details link does not work','Event canceled / no longer happening'
));

-- Ordinary workflow notification log. It stores delivery metadata, never OTPs
-- or full message bodies.
create table if not exists public.workflow_notifications (
  id uuid primary key default gen_random_uuid(), dedupe_key text not null unique,
  notification_type text not null check(notification_type in ('needs_correction','rejected','published')),
  content_type text not null check(content_type in ('opportunity','event','announcement')), content_id uuid not null,
  recipient text not null, status text not null default 'pending' check(status in ('pending','sent','failed')),
  provider_id text, error_code text, attempted_at timestamptz not null default now(), completed_at timestamptz,
  actor_id uuid not null references public.user_roles(id), audit_event_id uuid not null references public.audit_events(id)
);
alter table public.workflow_notifications enable row level security;
create policy "super admins read workflow notification logs" on public.workflow_notifications for select to authenticated using(public.is_super_admin());
revoke all on table public.workflow_notifications from public, anon, authenticated;
grant select on table public.workflow_notifications to authenticated;

create or replace function public.claim_workflow_notification(p_content_type text,p_content_id uuid,p_notification_type text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor public.user_roles; recipient text; title text; current_status text; audit public.audit_events; notification public.workflow_notifications; public_path text;
begin
  if not public.is_reviewer() then raise exception 'Reviewer access required'; end if;
  if p_notification_type not in ('needs_correction','rejected','published') then raise exception 'Invalid notification type'; end if;
  select * into actor from public.user_roles where auth_user_id=auth.uid() and status='active' limit 1;
  if p_content_type='opportunity' then select o.status,o.title,u.email into current_status,title,recipient from public.opportunities o join public.user_roles u on u.id=o.submitted_by where o.id=p_content_id;
  elsif p_content_type='event' then select e.status,e.title,u.email into current_status,title,recipient from public.events e join public.user_roles u on u.id=e.submitted_by where e.id=p_content_id;
  elsif p_content_type='announcement' then select a.status,a.title,u.email into current_status,title,recipient from public.announcements a join public.user_roles u on u.id=a.submitted_by where a.id=p_content_id;
  else raise exception 'Invalid content type'; end if;
  if current_status is distinct from p_notification_type then raise exception 'Notification does not match current content status'; end if;
  select * into audit from public.audit_events where content_type=p_content_type and content_id=p_content_id and new_status=current_status order by created_at desc limit 1;
  if audit.id is null then raise exception 'Matching audit event not found'; end if;
  insert into public.workflow_notifications(dedupe_key,notification_type,content_type,content_id,recipient,actor_id,audit_event_id)
  values(audit.id::text||':'||p_notification_type,p_notification_type,p_content_type,p_content_id,recipient,actor.id,audit.id)
  on conflict(dedupe_key) do nothing returning * into notification;
  if notification.id is null then return jsonb_build_object('send',false,'duplicate',true); end if;
  public_path:=case p_content_type when 'opportunity' then '/opportunities/' when 'event' then '/events/' else '/announcements/' end||p_content_id::text;
  return jsonb_build_object('send',true,'notification_id',notification.id,'recipient',recipient,'title',title,'reason',audit.reason,'public_path',public_path,'audit_timestamp',audit.created_at);
end;
$$;
revoke all on function public.claim_workflow_notification(text,uuid,text) from public, anon;
grant execute on function public.claim_workflow_notification(text,uuid,text) to authenticated;

create or replace function public.complete_workflow_notification(p_notification_id uuid,p_status text,p_provider_id text default null,p_error_code text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.is_reviewer() then raise exception 'Reviewer access required'; end if;
  if p_status not in ('sent','failed') then raise exception 'Invalid notification status'; end if;
  update public.workflow_notifications set status=p_status,provider_id=nullif(left(trim(coalesce(p_provider_id,'')),300),''),error_code=nullif(left(trim(coalesce(p_error_code,'')),200),''),completed_at=now()
  where id=p_notification_id and actor_id in (select id from public.user_roles where auth_user_id=auth.uid() and status='active');
end;
$$;
revoke all on function public.complete_workflow_notification(uuid,text,text,text) from public, anon;
grant execute on function public.complete_workflow_notification(uuid,text,text,text) to authenticated;

-- Admins and Super Admins share the published Apply ASAP maintenance workflow.
drop policy if exists "super admins manage opportunity availability" on public.opportunity_availability_reviews;
create policy "admins manage opportunity availability" on public.opportunity_availability_reviews for all to authenticated using(public.is_admin()) with check(public.is_admin());

-- Preserve the correction note and expose a meaningful lifecycle update time.
create or replace function public.get_my_submission_status()
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor public.user_roles; result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into actor from public.user_roles where auth_user_id=auth.uid() and status='active' order by case role when 'super_admin' then 1 when 'admin' then 2 when 'reviewer' then 3 else 4 end limit 1;
  if actor.id is null then raise exception 'Active contributor role required'; end if;
  with identity_roles as (select id from public.user_roles where auth_user_id=auth.uid()), submissions as (
    select 'event'::text content_type,e.id content_id,e.title,e.status,e.created_at,greatest(e.created_at,coalesce(e.correction_requested_at,e.created_at),coalesce(e.resubmitted_at,e.created_at)) updated_at,jsonb_build_object('title',e.title,'org',e.org,'date',e.date,'end_date',e.end_date,'time',e.time,'location',e.location,'description',e.description,'registration_link',e.registration_link,'contact_name',e.contact_name,'contact_email',e.contact_email) editable from public.events e where e.submitted_by in(select id from identity_roles)
    union all
    select 'opportunity',o.id,o.title,o.status,o.created_at,greatest(o.created_at,coalesce(o.correction_requested_at,o.created_at),coalesce(o.resubmitted_at,o.created_at)),jsonb_build_object('title',o.title,'org',o.org,'deadline_type',o.deadline_type,'deadline',o.deadline,'posted_date',o.posted_date,'compensation_type',o.compensation_type,'location',o.location,'description',o.description,'eligibility',o.eligibility,'link',o.link,'contact_name',o.contact_name,'contact_email',o.contact_email) from public.opportunities o where o.submitted_by in(select id from identity_roles)
    union all
    select 'announcement',a.id,a.title,a.status,a.created_at,greatest(a.created_at,coalesce(a.correction_requested_at,a.created_at),coalesce(a.resubmitted_at,a.created_at)),jsonb_build_object('title',a.title,'source',a.source,'body',a.body,'source_url',a.source_url,'category',a.category) from public.announcements a where a.submitted_by in(select id from identity_roles)
  )
  select coalesce(jsonb_agg(jsonb_build_object('content_type',s.content_type,'content_id',s.content_id,'title',s.title,'status',s.status,'created_at',s.created_at,'updated_at',greatest(s.updated_at,coalesce(e.updated_at,s.updated_at)),'reviewer_note',e.reviewer_notes,'editable',s.editable) order by greatest(s.updated_at,coalesce(e.updated_at,s.updated_at)) desc),'[]'::jsonb) into result
  from submissions s left join lateral(select reviewer_notes,updated_at from public.review_verification_evidence r where r.content_type=s.content_type and r.content_id=s.content_id and r.decision in('needs_correction','rejected') order by r.updated_at desc limit 1)e on true
  where not exists(select 1 from public.submission_dashboard_dismissals d where d.user_role_id in(select id from identity_roles) and d.content_type=s.content_type and d.content_id=s.content_id);
  return result;
end;
$$;
revoke all on function public.get_my_submission_status() from public, anon;
grant execute on function public.get_my_submission_status() to authenticated;

commit;
