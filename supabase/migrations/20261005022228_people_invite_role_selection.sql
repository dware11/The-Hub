-- Allow Super Admin to select a controlled initial role while preserving the
-- existing invitation lifecycle and database-owned first-login reconciliation.
begin;

alter table public.people_invitations drop constraint if exists people_invitations_intended_role_check;
alter table public.people_invitations add constraint people_invitations_intended_role_check
  check(intended_role in ('contributor','reviewer','admin'));

drop function public.create_people_invitation(text,text,text,text,uuid);
create function public.create_people_invitation(
  p_email text,
  p_full_name text,
  p_intended_role text,
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
  if p_intended_role not in ('contributor','reviewer','admin') then raise exception 'Choose a valid initial Hub access role'; end if;
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
    normalized_affiliation:=null; p_approved_organization_id:=null;
  else
    p_approved_organization_id:=null;
    if normalized_affiliation is null then raise exception 'Enter the affiliation name'; end if;
  end if;

  insert into public.people_invitations(email,full_name,intended_role,affiliation_type,affiliation_value,approved_organization_id,invited_by)
  values(normalized_email,normalized_name,p_intended_role,p_affiliation_type,normalized_affiliation,p_approved_organization_id,actor.id)
  returning * into created;
  insert into public.audit_events(content_type,actor_type,actor_id,action,new_status,changes)
  values('system','administrator',actor.id,'person_invited','pending',jsonb_build_object(
    'invitation_id',created.id,'invited_email',created.email,'intended_role',created.intended_role,
    'affiliation_type',created.affiliation_type,'affiliation',created.affiliation_value));
  return jsonb_build_object('ok',true,'created',true,'invitation_id',created.id);
end; $$;
revoke all on function public.create_people_invitation(text,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.create_people_invitation(text,text,text,text,text,uuid) to authenticated;

commit;
