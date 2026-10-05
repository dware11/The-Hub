-- Super-admin removal that revokes authorization and hides the person from
-- the normal roster while preserving the referenced role row and all history.
begin;

alter table public.user_roles drop constraint if exists user_roles_status_check;
alter table public.user_roles add constraint user_roles_status_check check(status in ('active','needs_review','removed'));

create or replace function public.remove_person_access(p_user_role_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor public.user_roles; target public.user_roles; remaining_super_admins integer;
begin
  select * into actor from public.user_roles where auth_user_id=auth.uid() and status='active' and role='super_admin' limit 1;
  if actor.id is null then raise exception 'Super administrator access required'; end if;
  select * into target from public.user_roles where id=p_user_role_id for update;
  if target.id is null or target.status='removed' then raise exception 'Person not found in the access roster'; end if;
  if target.id=actor.id then raise exception 'You cannot remove your own access'; end if;
  if target.role='super_admin' then
    select count(*) into remaining_super_admins from public.user_roles where role='super_admin' and status='active' and id<>target.id;
    if remaining_super_admins<1 then raise exception 'At least one active super administrator is required'; end if;
  end if;
  update public.user_roles set status='removed',auth_user_id=null where id=target.id;
  update public.people_invitations set deactivated_at=coalesce(deactivated_at,now()),updated_at=now()
    where accepted_auth_user_id=target.auth_user_id and status='accepted';
  insert into public.audit_events(content_type,actor_type,actor_id,action,previous_status,new_status,changes)
  values('system','administrator',actor.id,'person_removed',target.status,'removed',jsonb_build_object(
    'target_role_id',target.id,'removed_email',target.email,'previous_role',target.role,'history_preserved',true));
  return jsonb_build_object('ok',true,'user_role_id',target.id);
end; $$;
revoke all on function public.remove_person_access(uuid) from public,anon,authenticated;
grant execute on function public.remove_person_access(uuid) to authenticated;

create or replace function public.get_people_access_roster()
returns table(id uuid,name text,email text,organization_department text,role text,status text,assigned_by text,assigned_at timestamptz,last_submission timestamptz)
language sql stable security definer set search_path=''
as $$
  select ur.id,coalesce(ur.full_name,''),ur.email,coalesce(ur.org,''),ur.role,ur.status,null::text,ur.created_at,
    greatest((select max(created_at) from public.opportunities where submitted_by=ur.id),(select max(created_at) from public.events where submitted_by=ur.id),(select max(created_at) from public.announcements where submitted_by=ur.id))
  from public.user_roles ur where public.is_admin() and ur.status<>'removed' order by ur.created_at desc;
$$;
revoke all on function public.get_people_access_roster() from public,anon,authenticated;
grant execute on function public.get_people_access_roster() to authenticated;

drop function public.create_people_invitation(text,text,text,text,text,text,uuid);
create function public.create_people_invitation(p_email text,p_first_name text,p_last_name text,p_intended_role text,p_affiliation_type text,p_affiliation_value text default null,p_approved_organization_id uuid default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor public.user_roles; existing_role public.user_roles; existing_invite public.people_invitations; created public.people_invitations; organization public.approved_organizations;
  normalized_email text:=lower(trim(coalesce(p_email,''))); normalized_first text:=nullif(left(trim(coalesce(p_first_name,'')),80),''); normalized_last text:=nullif(left(trim(coalesce(p_last_name,'')),80),''); normalized_affiliation text:=nullif(left(trim(coalesce(p_affiliation_value,'')),240),'');
begin
  select * into actor from public.user_roles where auth_user_id=auth.uid() and status='active' and role='super_admin' limit 1;
  if actor.id is null then raise exception 'Super administrator access required'; end if;
  if normalized_email !~ '^[^@[:space:]]+@pvamu[.]edu$' then raise exception 'Enter a valid PVAMU email address'; end if;
  if normalized_first is null or normalized_last is null then raise exception 'Enter the person''s first and last name'; end if;
  if p_intended_role not in ('contributor','reviewer','admin') then raise exception 'Choose a valid initial Hub access role'; end if;
  if p_affiliation_type not in ('student_organization','department','college','university_office','none') then raise exception 'Choose a valid affiliation type'; end if;
  select * into existing_role from public.user_roles where lower(trim(email))=normalized_email limit 1;
  if existing_role.id is not null and existing_role.status<>'removed' then
    if existing_role.status='active' then return jsonb_build_object('ok',false,'reason','active','message','This person already has access to the Hub.'); end if;
    return jsonb_build_object('ok',false,'reason','inactive','message','This person is inactive. Use the existing reactivation control in People & Access.');
  end if;
  select * into existing_invite from public.people_invitations where lower(email)=normalized_email and status='pending' order by invited_at desc limit 1;
  if existing_invite.id is not null then return jsonb_build_object('ok',false,'reason','pending','message','Invitation pending','invitation_id',existing_invite.id); end if;
  if p_affiliation_type='student_organization' then
    select * into organization from public.approved_organizations where id=p_approved_organization_id and status='active' and taxonomy_scope='organization';
    if organization.id is null then raise exception 'Choose an approved student organization'; end if; normalized_affiliation:=organization.name;
  elsif p_affiliation_type='none' then normalized_affiliation:=null;p_approved_organization_id:=null;
  else p_approved_organization_id:=null;if normalized_affiliation is null then raise exception 'Enter the affiliation name';end if;end if;
  insert into public.people_invitations(email,first_name,last_name,full_name,intended_role,affiliation_type,affiliation_value,approved_organization_id,invited_by)
  values(normalized_email,normalized_first,normalized_last,normalized_first||' '||normalized_last,p_intended_role,p_affiliation_type,normalized_affiliation,p_approved_organization_id,actor.id) returning * into created;
  insert into public.audit_events(content_type,actor_type,actor_id,action,new_status,changes) values('system','administrator',actor.id,'person_invited','pending',jsonb_build_object('invitation_id',created.id,'invited_email',created.email,'intended_role',created.intended_role,'affiliation_type',created.affiliation_type,'affiliation',created.affiliation_value));
  return jsonb_build_object('ok',true,'created',true,'invitation_id',created.id);
end; $$;
revoke all on function public.create_people_invitation(text,text,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.create_people_invitation(text,text,text,text,text,text,uuid) to authenticated;

create or replace function public.claim_my_role()
returns public.user_roles language plpgsql security definer set search_path=''
as $$
declare caller_id uuid:=auth.uid();caller_email text;claimed public.user_roles;invitation public.people_invitations;
begin
  if caller_id is null then raise exception 'Authentication required';end if;
  select lower(trim(email)) into caller_email from auth.users where id=caller_id and email_confirmed_at is not null;
  if caller_email is null then raise exception 'A verified email is required';end if;
  select * into claimed from public.user_roles where auth_user_id=caller_id;
  if claimed.id is not null and claimed.status<>'removed' then return claimed;end if;
  if claimed.id is null then
    update public.user_roles set auth_user_id=caller_id where id=(select id from public.user_roles where lower(trim(email))=caller_email and status='active' and auth_user_id is null for update skip locked limit 1) returning * into claimed;
    if claimed.id is not null then insert into public.audit_events(content_type,actor_type,actor_id,action,changes) values('system',case when claimed.role in('admin','super_admin') then 'administrator' when claimed.role='reviewer' then 'reviewer' else 'contributor' end,claimed.id,'role_claimed',jsonb_build_object('auth_user_id',caller_id));return claimed;end if;
  end if;
  select * into invitation from public.people_invitations where email=caller_email and status='pending' for update skip locked limit 1;
  if invitation.id is null then return claimed;end if;
  select * into claimed from public.user_roles where lower(trim(email))=caller_email and status='removed' for update;
  if claimed.id is not null then
    update public.user_roles set auth_user_id=caller_id,role=invitation.intended_role,status='active',full_name=invitation.full_name,org=invitation.affiliation_value where id=claimed.id returning * into claimed;
  else
    insert into public.user_roles(email,auth_user_id,role,status,full_name,org) values(invitation.email,caller_id,invitation.intended_role,'active',invitation.full_name,invitation.affiliation_value) returning * into claimed;
  end if;
  update public.people_invitations set status='accepted',accepted_at=now(),accepted_auth_user_id=caller_id,updated_at=now() where id=invitation.id;
  insert into public.audit_events(content_type,actor_type,actor_id,action,previous_status,new_status,changes) values('system',case when claimed.role='admin' then 'administrator' when claimed.role='reviewer' then 'reviewer' else 'contributor' end,claimed.id,'invitation_accepted','pending','accepted',jsonb_build_object('invitation_id',invitation.id,'affiliation_type',invitation.affiliation_type,'affiliation',invitation.affiliation_value));
  return claimed;
end; $$;
revoke all on function public.claim_my_role() from public,anon,authenticated;
grant execute on function public.claim_my_role() to authenticated;

commit;
