-- Email OTP launch alignment, contributor access workflow, super-admin boundary,
-- and audited published-content controls. Safe to apply after all earlier migrations.

begin;

alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check
  check (role in ('contributor','reviewer','admin','super_admin'));

create or replace function public.is_verified_contributor()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select public.has_active_role(array['contributor','reviewer','admin','super_admin']);
$$;
create or replace function public.is_reviewer()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select public.has_active_role(array['reviewer','admin','super_admin']);
$$;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select public.has_active_role(array['admin','super_admin']);
$$;
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select public.has_active_role(array['super_admin']);
$$;
revoke all on function public.is_super_admin() from public,anon;
grant execute on function public.is_super_admin() to authenticated;

create or replace function public.claim_my_role()
returns public.user_roles language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare caller_id uuid:=auth.uid(); caller_email text; claimed public.user_roles;
begin
  if caller_id is null then raise exception 'Authentication required'; end if;
  select lower(trim(email)) into caller_email from auth.users
    where id=caller_id and email_confirmed_at is not null;
  if caller_email is null then raise exception 'A verified email is required'; end if;
  select * into claimed from public.user_roles where auth_user_id=caller_id;
  if found then return claimed; end if;
  update public.user_roles set auth_user_id=caller_id
    where id=(select id from public.user_roles where lower(trim(email))=caller_email
      and status='active' and auth_user_id is null for update skip locked limit 1)
    returning * into claimed;
  if not found then return null; end if;
  insert into public.audit_events(content_type,actor_type,actor_id,action,changes)
    values('system',case when claimed.role in ('admin','super_admin') then 'administrator' when claimed.role='reviewer' then 'reviewer' else 'contributor' end,
      claimed.id,'role_claimed',jsonb_build_object('auth_user_id',caller_id));
  return claimed;
end $$;

create table public.contributor_access_requests (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  name text not null check (char_length(name) between 2 and 160),
  organization_department text not null check (char_length(organization_department) between 2 and 240),
  representation_type text not null check (representation_type in ('student_organization','department','faculty_staff','sponsor_company','alumni','external_organization')),
  pvamu_contact_name text,
  pvamu_contact_email text,
  access_intent text not null check (access_intent in ('one_time','recurring')),
  reason_context text not null check (char_length(reason_context) between 10 and 1000),
  request_target text not null check (request_target in ('opportunity','event','announcement','general')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  approved_by uuid references public.user_roles(id),
  approval_auth_uid uuid references auth.users(id),
  approval_date timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(auth_user_id)
);
alter table public.contributor_access_requests enable row level security;
revoke all on table public.contributor_access_requests from public,anon,authenticated;
grant select on table public.contributor_access_requests to authenticated;
create policy "owners read access request" on public.contributor_access_requests for select to authenticated using(auth_user_id=auth.uid());
create policy "reviewers read access requests" on public.contributor_access_requests for select to authenticated using(public.is_reviewer());

create or replace function public.request_contributor_access(
  p_name text,p_organization_department text,p_representation_type text,
  p_pvamu_contact_name text,p_pvamu_contact_email text,p_access_intent text,
  p_reason_context text,p_request_target text
) returns public.contributor_access_requests language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare caller_id uuid:=auth.uid(); caller_email text; needs_contact boolean; requested public.contributor_access_requests;
begin
  select lower(trim(email)) into caller_email from auth.users where id=caller_id and email_confirmed_at is not null;
  if caller_email is null then raise exception 'Verified email authentication required'; end if;
  if p_representation_type not in ('student_organization','department','faculty_staff','sponsor_company','alumni','external_organization') then raise exception 'Invalid representation type'; end if;
  if p_access_intent not in ('one_time','recurring') or p_request_target not in ('opportunity','event','announcement','general') then raise exception 'Invalid request selection'; end if;
  needs_contact := caller_email not like '%@pvamu.edu' or p_representation_type in ('sponsor_company','alumni','external_organization');
  if needs_contact and lower(trim(coalesce(p_pvamu_contact_email,''))) not like '%@pvamu.edu' then raise exception 'A PVAMU contact email is required'; end if;
  insert into public.contributor_access_requests(auth_user_id,email,name,organization_department,representation_type,pvamu_contact_name,pvamu_contact_email,access_intent,reason_context,request_target,status,approved_by,approval_auth_uid,approval_date,rejection_reason)
  values(caller_id,caller_email,left(trim(p_name),160),left(trim(p_organization_department),240),p_representation_type,nullif(left(trim(coalesce(p_pvamu_contact_name,'')),160),''),nullif(lower(left(trim(coalesce(p_pvamu_contact_email,'')),320)),''),p_access_intent,left(trim(p_reason_context),1000),p_request_target,'pending',null,null,null,null)
  on conflict(auth_user_id) do update set email=excluded.email,name=excluded.name,organization_department=excluded.organization_department,representation_type=excluded.representation_type,pvamu_contact_name=excluded.pvamu_contact_name,pvamu_contact_email=excluded.pvamu_contact_email,access_intent=excluded.access_intent,reason_context=excluded.reason_context,request_target=excluded.request_target,status='pending',approved_by=null,approval_auth_uid=null,approval_date=null,rejection_reason=null,updated_at=now()
  returning * into requested;
  return requested;
end $$;
revoke all on function public.request_contributor_access(text,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.request_contributor_access(text,text,text,text,text,text,text,text) to authenticated;

create or replace function public.review_contributor_access_request(p_request_id uuid,p_decision text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare actor public.user_roles; requested public.contributor_access_requests; granted public.user_roles;
begin
  if not public.is_reviewer() then raise exception 'Reviewer access required'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'Invalid access decision'; end if;
  select * into actor from public.user_roles where auth_user_id=auth.uid() and status='active';
  select * into requested from public.contributor_access_requests where id=p_request_id and status='pending' for update;
  if requested.id is null then raise exception 'Pending request not found'; end if;
  if p_decision='approved' then
    insert into public.user_roles(email,auth_user_id,role,status,full_name,org)
      values(requested.email,requested.auth_user_id,'contributor','active',requested.name,requested.organization_department)
    on conflict(email) do update set
      auth_user_id=case when public.user_roles.auth_user_id is null or public.user_roles.auth_user_id=excluded.auth_user_id then excluded.auth_user_id else public.user_roles.auth_user_id end,
      role=case when public.user_roles.role in ('reviewer','admin','super_admin') then public.user_roles.role else 'contributor' end,
      status='active',full_name=excluded.full_name,org=excluded.org
    returning * into granted;
    if granted.auth_user_id is distinct from requested.auth_user_id then raise exception 'Role is bound to another identity'; end if;
  end if;
  update public.contributor_access_requests set status=p_decision,approved_by=actor.id,approval_auth_uid=auth.uid(),approval_date=now(),rejection_reason=case when p_decision='rejected' then nullif(left(trim(coalesce(p_reason,'')),500),'') else null end,updated_at=now() where id=requested.id;
  insert into public.audit_events(content_type,actor_type,actor_id,action,changes)
    values('system',case when actor.role='reviewer' then 'reviewer' else 'administrator' end,actor.id,'contributor_access_'||p_decision,jsonb_build_object('request_id',requested.id,'request_email',requested.email,'granted_role',case when p_decision='approved' then 'contributor' else null end,'approval_auth_uid',auth.uid()));
  return jsonb_build_object('ok',true,'status',p_decision,'request_id',requested.id);
end $$;
revoke all on function public.review_contributor_access_request(uuid,text,text) from public,anon;
grant execute on function public.review_contributor_access_request(uuid,text,text) to authenticated;

-- Super-admin-only platform role administration. Reviewers approve contributor requests through the narrow RPC above.
create or replace function public.provision_user_role(p_email text,p_role text,p_status text default 'active')
returns public.user_roles language plpgsql security definer set search_path=public,pg_temp as $$
declare normalized_email text:=lower(trim(p_email)); provisioned public.user_roles; actor public.user_roles;
begin
  if not public.is_super_admin() then raise exception 'Super administrator access required'; end if;
  if p_role not in ('contributor','reviewer','admin','super_admin') or p_status not in ('active','needs_review') then raise exception 'Invalid role or status'; end if;
  insert into public.user_roles(email,role,status) values(normalized_email,p_role,p_status)
  on conflict(email) do update set role=excluded.role,status=excluded.status returning * into provisioned;
  select * into actor from public.user_roles where auth_user_id=auth.uid();
  insert into public.audit_events(content_type,actor_type,actor_id,action,changes) values('system','administrator',actor.id,'role_provisioned',jsonb_build_object('target_role_id',provisioned.id,'role',p_role,'status',p_status));
  return provisioned;
end $$;

-- Common content lifecycle with soft deletion and restoration.
alter table public.opportunities add column if not exists deleted_at timestamptz, add column if not exists deleted_by uuid references public.user_roles(id), add column if not exists deleted_previous_status text;
alter table public.events add column if not exists deleted_at timestamptz, add column if not exists deleted_by uuid references public.user_roles(id), add column if not exists deleted_previous_status text;
alter table public.announcements add column if not exists deleted_at timestamptz, add column if not exists deleted_by uuid references public.user_roles(id), add column if not exists deleted_previous_status text;
alter table public.opportunities drop constraint if exists opportunities_status_check;
alter table public.events drop constraint if exists events_status_check;
alter table public.announcements drop constraint if exists announcements_status_check;
alter table public.opportunities add constraint opportunities_status_check check(status in ('pending','published','rejected','unpublished','archived','deleted'));
alter table public.events add constraint events_status_check check(status in ('pending','published','rejected','unpublished','archived','deleted'));
alter table public.announcements add constraint announcements_status_check check(status in ('pending','published','rejected','unpublished','archived','deleted'));

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
      update public.events set title=case when p_changes?'title' then left(trim(p_changes->>'title'),240) else title end,description=case when p_changes?'description' then left(trim(p_changes->>'description'),5000) else description end,org=case when p_changes?'organization' then left(trim(p_changes->>'organization'),240) else org end,source_url=case when p_changes?'source_url' then nullif(left(trim(p_changes->>'source_url'),2000),'') else source_url end where id=p_content_id;
    else
      update public.opportunities set title=case when p_changes?'title' then left(trim(p_changes->>'title'),240) else title end,description=case when p_changes?'description' then left(trim(p_changes->>'description'),5000) else description end,org=case when p_changes?'organization' then left(trim(p_changes->>'organization'),240) else org end,source_url=case when p_changes?'source_url' then nullif(left(trim(p_changes->>'source_url'),2000),'') else source_url end where id=p_content_id;
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
end $$;
revoke all on function public.manage_published_content(text,uuid,text,jsonb) from public,anon;
grant execute on function public.manage_published_content(text,uuid,text,jsonb) to authenticated;

create or replace function public.get_access_request_export()
returns table(name text,email text,organization_department text,access_role text,status text,approved_by text,approval_date timestamptz,last_submission timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
  select r.name,r.email,r.organization_department,coalesce(ur.role,'viewer'),r.status,approver.full_name,r.approval_date,
    greatest((select max(created_at) from public.opportunities where submitted_by=ur.id),(select max(created_at) from public.events where submitted_by=ur.id),(select max(created_at) from public.announcements where submitted_by=ur.id))
  from public.contributor_access_requests r left join public.user_roles ur on ur.auth_user_id=r.auth_user_id left join public.user_roles approver on approver.id=r.approved_by
  where public.is_reviewer() order by r.created_at desc;
$$;
revoke all on function public.get_access_request_export() from public,anon;
grant execute on function public.get_access_request_export() to authenticated;

do $$ begin
  if exists(select 1 from public.user_roles where role not in ('contributor','reviewer','admin','super_admin')) then raise exception 'Final RBAC postcondition failed'; end if;
end $$;

commit;
