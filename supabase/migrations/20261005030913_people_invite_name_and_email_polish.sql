-- Preserve full_name compatibility while capturing required first/last names
-- for new V1 People invitations and role-aware email personalization.
begin;

alter table public.people_invitations add column if not exists first_name text;
alter table public.people_invitations add column if not exists last_name text;
update public.people_invitations set
  first_name=coalesce(first_name,nullif(split_part(trim(coalesce(full_name,'')),' ',1),'')),
  last_name=coalesce(last_name,nullif(trim(substr(trim(coalesce(full_name,'')),length(split_part(trim(coalesce(full_name,'')),' ',1))+1)),''))
where full_name is not null;

drop function public.create_people_invitation(text,text,text,text,text,uuid);
create function public.create_people_invitation(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_intended_role text,
  p_affiliation_type text,
  p_affiliation_value text default null,
  p_approved_organization_id uuid default null
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  actor public.user_roles; existing_role public.user_roles; existing_invite public.people_invitations;
  created public.people_invitations; organization public.approved_organizations;
  normalized_email text:=lower(trim(coalesce(p_email,'')));
  normalized_first text:=nullif(left(trim(coalesce(p_first_name,'')),80),'');
  normalized_last text:=nullif(left(trim(coalesce(p_last_name,'')),80),'');
  normalized_affiliation text:=nullif(left(trim(coalesce(p_affiliation_value,'')),240),'');
begin
  select * into actor from public.user_roles where auth_user_id=auth.uid() and status='active' and role='super_admin' limit 1;
  if actor.id is null then raise exception 'Super administrator access required'; end if;
  if normalized_email !~ '^[^@[:space:]]+@pvamu[.]edu$' then raise exception 'Enter a valid PVAMU email address'; end if;
  if normalized_first is null or normalized_last is null then raise exception 'Enter the person''s first and last name'; end if;
  if p_intended_role not in ('contributor','reviewer','admin') then raise exception 'Choose a valid initial Hub access role'; end if;
  if p_affiliation_type not in ('student_organization','department','college','university_office','none') then raise exception 'Choose a valid affiliation type'; end if;

  select * into existing_role from public.user_roles where lower(trim(email))=normalized_email limit 1;
  if existing_role.id is not null then
    if existing_role.status='active' then return jsonb_build_object('ok',false,'reason','active','message','This person already has access to the Hub.'); end if;
    return jsonb_build_object('ok',false,'reason','inactive','message','This person is inactive. Use the existing reactivation control in People & Access.');
  end if;
  select * into existing_invite from public.people_invitations where lower(email)=normalized_email and status='pending' order by invited_at desc limit 1;
  if existing_invite.id is not null then return jsonb_build_object('ok',false,'reason','pending','message','Invitation pending','invitation_id',existing_invite.id); end if;

  if p_affiliation_type='student_organization' then
    select * into organization from public.approved_organizations where id=p_approved_organization_id and status='active' and taxonomy_scope='organization';
    if organization.id is null then raise exception 'Choose an approved student organization'; end if;
    normalized_affiliation:=organization.name;
  elsif p_affiliation_type='none' then normalized_affiliation:=null; p_approved_organization_id:=null;
  else
    p_approved_organization_id:=null;
    if normalized_affiliation is null then raise exception 'Enter the affiliation name'; end if;
  end if;

  insert into public.people_invitations(email,first_name,last_name,full_name,intended_role,affiliation_type,affiliation_value,approved_organization_id,invited_by)
  values(normalized_email,normalized_first,normalized_last,normalized_first||' '||normalized_last,p_intended_role,p_affiliation_type,normalized_affiliation,p_approved_organization_id,actor.id)
  returning * into created;
  insert into public.audit_events(content_type,actor_type,actor_id,action,new_status,changes)
  values('system','administrator',actor.id,'person_invited','pending',jsonb_build_object('invitation_id',created.id,'invited_email',created.email,'intended_role',created.intended_role,'affiliation_type',created.affiliation_type,'affiliation',created.affiliation_value));
  return jsonb_build_object('ok',true,'created',true,'invitation_id',created.id);
end; $$;
revoke all on function public.create_people_invitation(text,text,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.create_people_invitation(text,text,text,text,text,text,uuid) to authenticated;

create or replace function public.claim_people_invitation_email(p_invitation_id uuid,p_resend boolean default false)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor public.user_roles; invitation public.people_invitations; delivery public.people_invitation_notifications; attempt integer;
begin
  select * into actor from public.user_roles where auth_user_id=auth.uid() and status='active' and role='super_admin' limit 1;
  if actor.id is null then raise exception 'Super administrator access required'; end if;
  select * into invitation from public.people_invitations where id=p_invitation_id and status='pending' for update;
  if invitation.id is null then raise exception 'Pending invitation not found'; end if;
  if not p_resend and exists(select 1 from public.people_invitation_notifications where invitation_id=invitation.id) then return jsonb_build_object('send',false,'duplicate',true); end if;
  select coalesce(max(attempt_number),0)+1 into attempt from public.people_invitation_notifications where invitation_id=invitation.id;
  insert into public.people_invitation_notifications(invitation_id,attempt_number,recipient,actor_id)
  values(invitation.id,attempt,invitation.email,actor.id) returning * into delivery;
  return jsonb_build_object('send',true,'notification_id',delivery.id,'recipient',invitation.email,
    'first_name',coalesce(invitation.first_name,split_part(coalesce(invitation.full_name,''),' ',1)),
    'intended_role',invitation.intended_role,'attempt_number',attempt);
end; $$;
revoke all on function public.claim_people_invitation_email(uuid,boolean) from public,anon,authenticated;
grant execute on function public.claim_people_invitation_email(uuid,boolean) to authenticated;

commit;
