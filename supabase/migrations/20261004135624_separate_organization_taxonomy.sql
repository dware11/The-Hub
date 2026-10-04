-- Keep the controlled Organization taxonomy limited to approved student and
-- professional organizations. Institution, college, department, and employer
-- requests remain preserved as approved affiliations/hosts without becoming
-- Organization selector values.
alter table public.approved_organizations
  add column if not exists taxonomy_scope text not null default 'other';

alter table public.approved_organizations
  drop constraint if exists approved_organizations_taxonomy_scope_check;
alter table public.approved_organizations
  add constraint approved_organizations_taxonomy_scope_check
  check (taxonomy_scope in ('organization','affiliation','employer','other'));

update public.approved_organizations
set taxonomy_scope = case
  when organization_type in ('Student Organization','Professional Organization') then 'organization'
  when organization_type in ('Department or College','University Office') then 'affiliation'
  when organization_type = 'Company or Employer' then 'employer'
  else 'other'
end,
updated_at = now();

update public.approved_organizations
set taxonomy_scope = 'affiliation', updated_at = now()
where lower(trim(name)) in (
  'prairie view a&m university',
  'roy g. perry college of engineering'
);

insert into public.approved_organizations(name,organization_type,taxonomy_scope,status,approved_by)
select 'Council of Distinguished Engineers','Student Organization','organization','active',actor.id
from public.user_roles actor
where actor.role='super_admin' and actor.status='active'
order by actor.created_at nulls last, actor.id
limit 1
on conflict do nothing;

drop policy if exists "contributors read active approved organizations" on public.approved_organizations;
drop policy if exists "public reads active organization taxonomy" on public.approved_organizations;
drop policy if exists "authenticated read approved organization registry" on public.approved_organizations;
create policy "public reads active organization taxonomy"
on public.approved_organizations for select to anon
using(status='active' and taxonomy_scope='organization');
create policy "authenticated read approved organization registry"
on public.approved_organizations for select to authenticated
using(status='active' or public.is_admin());

revoke all on table public.approved_organizations from public, anon, authenticated;
grant select(name,organization_type,taxonomy_scope,status) on table public.approved_organizations to anon;
grant select on table public.approved_organizations to authenticated;

create or replace function public.review_organization_request(p_issue_id uuid,p_decision text,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor public.user_roles;
  request public.issue_reports;
  organization_id uuid;
  requested_name text;
  requested_type text;
  requested_scope text;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'Invalid organization decision'; end if;
  select * into actor from public.user_roles where auth_user_id=auth.uid() and status='active' limit 1;
  select * into request from public.issue_reports where id=p_issue_id and issue_type='Organization addition request' for update;
  if request.id is null then raise exception 'Organization request not found'; end if;
  if request.status='resolved' then raise exception 'Organization request is already resolved'; end if;
  if p_decision='approved' then
    requested_name := trim(request.request_details->>'organization_name');
    requested_type := trim(request.request_details->>'organization_type');
    requested_scope := case
      when requested_type in ('Student Organization','Professional Organization') then 'organization'
      when requested_type in ('Department or College','University Office') then 'affiliation'
      when requested_type='Company or Employer' then 'employer'
      else 'other'
    end;
    select id into organization_id from public.approved_organizations where lower(name)=lower(requested_name) limit 1;
    if organization_id is null then
      insert into public.approved_organizations(name,organization_type,taxonomy_scope,contact_name,contact_email,official_website,source_issue_id,approved_by)
      values(requested_name,requested_type,requested_scope,nullif(trim(request.request_details->>'organization_contact_name'),''),nullif(trim(request.request_details->>'organization_contact_email'),''),nullif(trim(request.request_details->>'official_website'),''),request.id,actor.id)
      returning id into organization_id;
    else
      update public.approved_organizations set
        organization_type=requested_type,
        taxonomy_scope=requested_scope,
        contact_name=nullif(trim(request.request_details->>'organization_contact_name'),''),
        contact_email=nullif(trim(request.request_details->>'organization_contact_email'),''),
        official_website=nullif(trim(request.request_details->>'official_website'),''),
        status='active', approved_by=actor.id, approved_at=now(), updated_at=now()
      where id=organization_id;
    end if;
  end if;
  update public.issue_reports set status='resolved',resolved_at=now(),resolved_by=actor.id,resolution_outcome=p_decision,resolution_note=nullif(left(trim(coalesce(p_note,'')),1000),'') where id=request.id;
  insert into public.audit_events(content_type,actor_type,actor_id,action,reason,changes)
  values('system','administrator',actor.id,'organization_request_'||p_decision,nullif(left(trim(coalesce(p_note,'')),1000),''),jsonb_build_object('issue_id',request.id,'organization_id',organization_id,'organization_name',request.request_details->>'organization_name','taxonomy_scope',requested_scope));
  return jsonb_build_object('ok',true,'decision',p_decision,'organization_id',organization_id,'taxonomy_scope',requested_scope);
end;
$$;
revoke all on function public.review_organization_request(uuid,text,text) from public, anon, authenticated;
grant execute on function public.review_organization_request(uuid,text,text) to authenticated;
