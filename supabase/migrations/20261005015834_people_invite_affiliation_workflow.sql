-- Super-admin-only People invitations, affiliation capture, delivery audit,
-- and first-OTP-login reconciliation. No Auth user is created by this flow.
begin;

create table public.people_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text,
  intended_role text not null default 'contributor' check (intended_role = 'contributor'),
  affiliation_type text not null check (affiliation_type in ('student_organization','department','college','university_office','none')),
  affiliation_value text,
  approved_organization_id uuid references public.approved_organizations(id),
  status text not null default 'pending' check (status in ('pending','accepted','canceled')),
  invited_by uuid not null references public.user_roles(id),
  invited_at timestamptz not null default now(),
  email_sent_at timestamptz,
  accepted_at timestamptz,
  accepted_auth_user_id uuid references auth.users(id) on delete set null,
  canceled_at timestamptz,
  canceled_by uuid references public.user_roles(id),
  deactivated_at timestamptz,
  updated_at timestamptz not null default now(),
  check (email = lower(trim(email))),
  check (email ~ '^[^@[:space:]]+@pvamu[.]edu$'),
  check ((affiliation_type='none' and affiliation_value is null and approved_organization_id is null)
    or (affiliation_type='student_organization' and affiliation_value is not null and approved_organization_id is not null)
    or (affiliation_type in ('department','college','university_office') and affiliation_value is not null and approved_organization_id is null))
);
create unique index people_invitations_one_pending_email
  on public.people_invitations(lower(email)) where status='pending';
create index people_invitations_email_history on public.people_invitations(lower(email),invited_at desc);

create table public.people_invitation_notifications (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.people_invitations(id),
  attempt_number integer not null check(attempt_number > 0),
  notification_type text not null default 'people_invitation' check(notification_type='people_invitation'),
  recipient text not null,
  status text not null default 'pending' check(status in ('pending','sent','failed')),
  provider_id text,
  error_code text,
  attempted_at timestamptz not null default now(),
  completed_at timestamptz,
  actor_id uuid not null references public.user_roles(id),
  unique(invitation_id,attempt_number)
);

alter table public.people_invitations enable row level security;
alter table public.people_invitation_notifications enable row level security;
create policy "super admins read people invitations" on public.people_invitations
  for select to authenticated using(public.is_super_admin());
create policy "super admins read invitation delivery audit" on public.people_invitation_notifications
  for select to authenticated using(public.is_super_admin());
revoke all on table public.people_invitations from public,anon,authenticated;
revoke all on table public.people_invitation_notifications from public,anon,authenticated;
grant select on table public.people_invitations to authenticated;
grant select on table public.people_invitation_notifications to authenticated;

create or replace function public.create_people_invitation(
  p_email text,
  p_full_name text,
  p_affiliation_type text,
  p_affiliation_value text default null,
  p_approved_organization_id uuid default null
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  actor public.user_roles;
  existing_role public.user_roles;
  existing_invite public.people_invitations;
  created public.people_invitations;
  normalized_email text:=lower(trim(coalesce(p_email,'')));
  normalized_name text:=nullif(left(trim(coalesce(p_full_name,'')),160),'');
  normalized_affiliation text:=nullif(left(trim(coalesce(p_affiliation_value,'')),240),'');
  organization public.approved_organizations;
begin
  select * into actor from public.user_roles
    where auth_user_id=auth.uid() and status='active' and role='super_admin' limit 1;
  if actor.id is null then raise exception 'Super administrator access required'; end if;
  if normalized_email !~ '^[^@[:space:]]+@pvamu[.]edu$' then raise exception 'Enter a valid PVAMU email address'; end if;
  if p_affiliation_type not in ('student_organization','department','college','university_office','none') then raise exception 'Choose a valid affiliation type'; end if;

  select * into existing_role from public.user_roles where lower(trim(email))=normalized_email limit 1;
  if existing_role.id is not null then
    if existing_role.status='active' then
      return jsonb_build_object('ok',false,'reason','active','message','This person already has access to the Hub.');
    end if;
    return jsonb_build_object('ok',false,'reason','inactive','message','This person is inactive. Use the existing reactivation control in People & Access.');
  end if;

  select * into existing_invite from public.people_invitations
    where lower(email)=normalized_email and status='pending' order by invited_at desc limit 1;
  if existing_invite.id is not null then
    return jsonb_build_object('ok',false,'reason','pending','message','Invitation pending','invitation_id',existing_invite.id);
  end if;

  if p_affiliation_type='student_organization' then
    select * into organization from public.approved_organizations
      where id=p_approved_organization_id and status='active' and taxonomy_scope='organization';
    if organization.id is null then raise exception 'Choose an approved student organization'; end if;
    normalized_affiliation:=organization.name;
  elsif p_affiliation_type='none' then
    normalized_affiliation:=null;
    p_approved_organization_id:=null;
  else
    p_approved_organization_id:=null;
    if normalized_affiliation is null then raise exception 'Enter the affiliation name'; end if;
  end if;

  insert into public.people_invitations(email,full_name,affiliation_type,affiliation_value,approved_organization_id,invited_by)
  values(normalized_email,normalized_name,p_affiliation_type,normalized_affiliation,p_approved_organization_id,actor.id)
  returning * into created;
  insert into public.audit_events(content_type,actor_type,actor_id,action,new_status,changes)
  values('system','administrator',actor.id,'person_invited','pending',jsonb_build_object(
    'invitation_id',created.id,'invited_email',created.email,'intended_role',created.intended_role,
    'affiliation_type',created.affiliation_type,'affiliation',created.affiliation_value));
  return jsonb_build_object('ok',true,'created',true,'invitation_id',created.id);
end; $$;
revoke all on function public.create_people_invitation(text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.create_people_invitation(text,text,text,text,uuid) to authenticated;

create or replace function public.claim_people_invitation_email(p_invitation_id uuid,p_resend boolean default false)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor public.user_roles; invitation public.people_invitations; delivery public.people_invitation_notifications; attempt integer;
begin
  select * into actor from public.user_roles where auth_user_id=auth.uid() and status='active' and role='super_admin' limit 1;
  if actor.id is null then raise exception 'Super administrator access required'; end if;
  select * into invitation from public.people_invitations where id=p_invitation_id and status='pending' for update;
  if invitation.id is null then raise exception 'Pending invitation not found'; end if;
  if not p_resend and exists(select 1 from public.people_invitation_notifications where invitation_id=invitation.id) then
    return jsonb_build_object('send',false,'duplicate',true);
  end if;
  select coalesce(max(attempt_number),0)+1 into attempt from public.people_invitation_notifications where invitation_id=invitation.id;
  insert into public.people_invitation_notifications(invitation_id,attempt_number,recipient,actor_id)
  values(invitation.id,attempt,invitation.email,actor.id) returning * into delivery;
  return jsonb_build_object('send',true,'notification_id',delivery.id,'recipient',invitation.email,'full_name',invitation.full_name,'attempt_number',attempt);
end; $$;
revoke all on function public.claim_people_invitation_email(uuid,boolean) from public,anon,authenticated;
grant execute on function public.claim_people_invitation_email(uuid,boolean) to authenticated;

create or replace function public.complete_people_invitation_email(p_notification_id uuid,p_status text,p_provider_id text default null,p_error_code text default null)
returns void language plpgsql security definer set search_path=''
as $$
declare actor public.user_roles; delivery public.people_invitation_notifications;
begin
  select * into actor from public.user_roles where auth_user_id=auth.uid() and status='active' and role='super_admin' limit 1;
  if actor.id is null then raise exception 'Super administrator access required'; end if;
  if p_status not in ('sent','failed') then raise exception 'Invalid notification status'; end if;
  update public.people_invitation_notifications set status=p_status,
    provider_id=nullif(left(trim(coalesce(p_provider_id,'')),300),''),
    error_code=nullif(left(trim(coalesce(p_error_code,'')),200),''),completed_at=now()
    where id=p_notification_id and actor_id=actor.id and status='pending' returning * into delivery;
  if delivery.id is null then raise exception 'Pending invitation notification not found'; end if;
  if p_status='sent' then update public.people_invitations set email_sent_at=coalesce(email_sent_at,now()),updated_at=now() where id=delivery.invitation_id; end if;
  insert into public.audit_events(content_type,actor_type,actor_id,action,new_status,changes)
  values('system','administrator',actor.id,'invitation_email_'||p_status,p_status,jsonb_build_object(
    'invitation_id',delivery.invitation_id,'notification_id',delivery.id,'notification_type',delivery.notification_type,
    'recipient',delivery.recipient,'provider_id',nullif(left(trim(coalesce(p_provider_id,'')),300),''),
    'error_code',nullif(left(trim(coalesce(p_error_code,'')),200),''),'attempt_number',delivery.attempt_number));
end; $$;
revoke all on function public.complete_people_invitation_email(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.complete_people_invitation_email(uuid,text,text,text) to authenticated;

create or replace function public.cancel_people_invitation(p_invitation_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor public.user_roles; invitation public.people_invitations;
begin
  select * into actor from public.user_roles where auth_user_id=auth.uid() and status='active' and role='super_admin' limit 1;
  if actor.id is null then raise exception 'Super administrator access required'; end if;
  update public.people_invitations set status='canceled',canceled_at=now(),canceled_by=actor.id,updated_at=now()
    where id=p_invitation_id and status='pending' returning * into invitation;
  if invitation.id is null then raise exception 'Pending invitation not found'; end if;
  insert into public.audit_events(content_type,actor_type,actor_id,action,previous_status,new_status,changes)
  values('system','administrator',actor.id,'invitation_canceled','pending','canceled',jsonb_build_object('invitation_id',invitation.id,'invited_email',invitation.email));
  return jsonb_build_object('ok',true,'invitation_id',invitation.id);
end; $$;
revoke all on function public.cancel_people_invitation(uuid) from public,anon,authenticated;
grant execute on function public.cancel_people_invitation(uuid) to authenticated;

create or replace function public.get_people_invitations()
returns table(id uuid,email text,full_name text,intended_role text,affiliation_type text,affiliation_value text,status text,invited_at timestamptz,invited_by_name text,email_sent_at timestamptz,accepted_at timestamptz,canceled_at timestamptz,deactivated_at timestamptz,last_delivery_status text)
language sql stable security definer set search_path=''
as $$
  select i.id,i.email,i.full_name,i.intended_role,i.affiliation_type,i.affiliation_value,i.status,i.invited_at,
    coalesce(inviter.full_name,inviter.email),i.email_sent_at,i.accepted_at,i.canceled_at,i.deactivated_at,
    (select n.status from public.people_invitation_notifications n where n.invitation_id=i.id order by n.attempt_number desc limit 1)
  from public.people_invitations i join public.user_roles inviter on inviter.id=i.invited_by
  where public.is_super_admin() order by i.invited_at desc;
$$;
revoke all on function public.get_people_invitations() from public,anon,authenticated;
grant execute on function public.get_people_invitations() to authenticated;

-- Preserve legacy email-preauthorization claims, then reconcile a pending
-- invitation only from database-owned values after verified OTP authentication.
create or replace function public.claim_my_role()
returns public.user_roles language plpgsql security definer set search_path=''
as $$
declare caller_id uuid:=auth.uid(); caller_email text; claimed public.user_roles; invitation public.people_invitations;
begin
  if caller_id is null then raise exception 'Authentication required'; end if;
  select lower(trim(email)) into caller_email from auth.users where id=caller_id and email_confirmed_at is not null;
  if caller_email is null then raise exception 'A verified email is required'; end if;
  select * into claimed from public.user_roles where auth_user_id=caller_id;
  if claimed.id is not null then return claimed; end if;

  update public.user_roles set auth_user_id=caller_id
    where id=(select id from public.user_roles where lower(trim(email))=caller_email and status='active' and auth_user_id is null for update skip locked limit 1)
    returning * into claimed;
  if claimed.id is not null then
    insert into public.audit_events(content_type,actor_type,actor_id,action,changes)
    values('system',case when claimed.role in ('admin','super_admin') then 'administrator' when claimed.role='reviewer' then 'reviewer' else 'contributor' end,claimed.id,'role_claimed',jsonb_build_object('auth_user_id',caller_id));
    return claimed;
  end if;

  select * into invitation from public.people_invitations
    where email=caller_email and status='pending' for update skip locked limit 1;
  if invitation.id is null then return null; end if;
  insert into public.user_roles(email,auth_user_id,role,status,full_name,org)
    values(invitation.email,caller_id,invitation.intended_role,'active',invitation.full_name,invitation.affiliation_value)
    returning * into claimed;
  update public.people_invitations set status='accepted',accepted_at=now(),accepted_auth_user_id=caller_id,updated_at=now()
    where id=invitation.id;
  insert into public.audit_events(content_type,actor_type,actor_id,action,previous_status,new_status,changes)
    values('system','contributor',claimed.id,'invitation_accepted','pending','accepted',jsonb_build_object(
      'invitation_id',invitation.id,'affiliation_type',invitation.affiliation_type,'affiliation',invitation.affiliation_value));
  return claimed;
end; $$;
revoke all on function public.claim_my_role() from public,anon,authenticated;
grant execute on function public.claim_my_role() to authenticated;

-- Extend the existing governed role-management function so deactivation is
-- also reflected in invitation history. Re-login cannot reactivate it because
-- accepted invitations are never reconsidered by claim_my_role().
create or replace function public.manage_user_role(p_user_role_id uuid,p_role text,p_status text default 'active')
returns public.user_roles language plpgsql security definer set search_path=''
as $$
declare actor public.user_roles; target public.user_roles; prior_role text; prior_status text; remaining_super_admins integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into actor from public.user_roles where auth_user_id=auth.uid() and status='active' for update;
  if actor.id is null or actor.role not in ('admin','super_admin') then raise exception 'Active administrator role required'; end if;
  if p_role not in ('contributor','reviewer','admin','super_admin') or p_status not in ('active','needs_review') then raise exception 'Invalid role or status'; end if;
  select * into target from public.user_roles where id=p_user_role_id for update;
  if target.id is null then raise exception 'User role not found'; end if;
  prior_role:=target.role; prior_status:=target.status;
  if actor.role='admin' and (p_role not in ('contributor','reviewer') or target.role in ('admin','super_admin')) then raise exception 'Administrators may manage contributors and reviewers only'; end if;
  if target.id=actor.id and (p_status<>'active' or p_role<>actor.role) then raise exception 'You cannot deactivate or change your own role'; end if;
  if target.role='super_admin' and (p_role<>'super_admin' or p_status<>'active') then
    select count(*) into remaining_super_admins from public.user_roles where role='super_admin' and status='active' and id<>target.id;
    if remaining_super_admins<1 then raise exception 'At least one active super administrator is required'; end if;
  end if;
  update public.user_roles set role=p_role,status=p_status where id=target.id returning * into target;
  if p_status='needs_review' and prior_status='active' then
    update public.people_invitations set deactivated_at=now(),updated_at=now() where accepted_auth_user_id=target.auth_user_id and status='accepted';
  elsif p_status='active' and prior_status='needs_review' then
    update public.people_invitations set deactivated_at=null,updated_at=now() where accepted_auth_user_id=target.auth_user_id and status='accepted';
  end if;
  insert into public.audit_events(content_type,actor_type,actor_id,action,changes)
  values('system','administrator',actor.id,'role_changed',jsonb_build_object('target_role_id',target.id,'actor_role',actor.role,'previous_role',prior_role,'new_role',p_role,'previous_status',prior_status,'status',p_status));
  return target;
end; $$;
revoke all on function public.manage_user_role(uuid,text,text) from public,anon,authenticated;
grant execute on function public.manage_user_role(uuid,text,text) to authenticated;

commit;
