-- Protected People & Access roster and auditable role management.
begin;

create or replace function public.manage_user_role(p_user_role_id uuid, p_role text, p_status text default 'active')
returns public.user_roles language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare actor public.user_roles; target public.user_roles; prior_role text; remaining_super_admins integer;
begin
  select * into actor from public.user_roles where auth_user_id=auth.uid() and status='active';
  if actor.id is null then raise exception 'Active role required'; end if;
  if p_role not in ('contributor','reviewer','admin','super_admin') or p_status not in ('active','needs_review') then raise exception 'Invalid role or status'; end if;
  select * into target from public.user_roles where id=p_user_role_id for update;
  if target.id is null then raise exception 'User role not found'; end if;
  prior_role:=target.role;
  if actor.role='reviewer' then raise exception 'Reviewer role management is not permitted'; end if;
  if actor.role='admin' and (p_role not in ('contributor','reviewer') or target.role='super_admin' or target.role='admin') then
    raise exception 'Administrators may manage contributors and reviewers only';
  end if;
  if target.id=actor.id and (p_status<>'active' or p_role<>actor.role) then raise exception 'You cannot deactivate or downgrade your own account'; end if;
  if target.role='super_admin' and p_role<>'super_admin' then
    select count(*) into remaining_super_admins from public.user_roles where role='super_admin' and status='active' and id<>target.id;
    if remaining_super_admins < 1 then raise exception 'At least one active super administrator is required'; end if;
  end if;
  update public.user_roles set role=p_role,status=p_status where id=target.id returning * into target;
  insert into public.audit_events(content_type,actor_type,actor_id,action,changes)
    values('system','administrator',actor.id,'role_changed',jsonb_build_object('target_role_id',target.id,'actor_role',actor.role,'previous_role',prior_role,'new_role',p_role,'status',p_status));
  return target;
end $$;
revoke all on function public.manage_user_role(uuid,text,text) from public,anon;
grant execute on function public.manage_user_role(uuid,text,text) to authenticated;

create or replace function public.get_people_access_roster()
returns table(id uuid,name text,email text,organization_department text,role text,status text,assigned_by text,assigned_at timestamptz,last_submission timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
  select ur.id, coalesce(ur.full_name,''), ur.email, coalesce(ur.org,''), ur.role, ur.status, null::text, ur.created_at,
    greatest((select max(created_at) from public.opportunities where submitted_by=ur.id),(select max(created_at) from public.events where submitted_by=ur.id),(select max(created_at) from public.announcements where submitted_by=ur.id))
  from public.user_roles ur where public.is_admin() order by ur.created_at desc;
$$;
revoke all on function public.get_people_access_roster() from public,anon;
grant execute on function public.get_people_access_roster() to authenticated;

commit;
