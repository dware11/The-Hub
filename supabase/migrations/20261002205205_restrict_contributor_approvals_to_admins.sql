-- Contributor access approvals provision accounts and are therefore an
-- administrative capability, not a content-review capability.
begin;

drop policy if exists "reviewers read access requests" on public.contributor_access_requests;
drop policy if exists "administrators read access requests" on public.contributor_access_requests;
create policy "administrators read access requests"
  on public.contributor_access_requests
  for select to authenticated
  using (public.is_admin());

create or replace function public.review_contributor_access_request(
  p_request_id uuid,
  p_decision text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare
  actor public.user_roles;
  requested public.contributor_access_requests;
  granted public.user_roles;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'Invalid access decision'; end if;

  select * into actor from public.user_roles
    where auth_user_id=auth.uid() and status='active' and role in ('admin','super_admin')
    for update;
  if actor.id is null then raise exception 'Administrator access required'; end if;

  select * into requested from public.contributor_access_requests
    where id=p_request_id and status='pending' for update;
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

  update public.contributor_access_requests set
    status=p_decision,
    approved_by=actor.id,
    approval_auth_uid=auth.uid(),
    approval_date=now(),
    rejection_reason=case when p_decision='rejected' then nullif(left(trim(coalesce(p_reason,'')),500),'') else null end,
    updated_at=now()
  where id=requested.id;

  insert into public.audit_events(content_type,actor_type,actor_id,action,changes)
    values('system','administrator',actor.id,'contributor_access_'||p_decision,
      jsonb_build_object('request_id',requested.id,'request_email',requested.email,'granted_role',case when p_decision='approved' then 'contributor' else null end,'approval_auth_uid',auth.uid()));

  return jsonb_build_object('ok',true,'status',p_decision,'request_id',requested.id);
end
$$;

revoke all on function public.review_contributor_access_request(uuid,text,text) from public,anon;
grant execute on function public.review_contributor_access_request(uuid,text,text) to authenticated;

create or replace function public.get_access_request_export()
returns table(name text,email text,organization_department text,access_role text,status text,approved_by text,approval_date timestamptz,last_submission timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
  select r.name,r.email,r.organization_department,coalesce(ur.role,'viewer'),r.status,approver.full_name,r.approval_date,
    greatest((select max(created_at) from public.opportunities where submitted_by=ur.id),(select max(created_at) from public.events where submitted_by=ur.id),(select max(created_at) from public.announcements where submitted_by=ur.id))
  from public.contributor_access_requests r
  left join public.user_roles ur on ur.auth_user_id=r.auth_user_id
  left join public.user_roles approver on approver.id=r.approved_by
  where public.is_admin()
  order by r.created_at desc;
$$;

revoke all on function public.get_access_request_export() from public,anon;
grant execute on function public.get_access_request_export() to authenticated;

commit;
