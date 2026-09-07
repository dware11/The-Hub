-- Append-only controls for reviewer recommendations and admin editorial fields.
begin;
create or replace function public.manage_announcement_editorial(p_announcement_id uuid,p_action text,p_priority text default null,p_is_featured boolean default null,p_featured_until date default null,p_expires_at date default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor public.user_roles; prior public.announcements; rec public.feature_recommendations;
begin
  select * into actor from public.user_roles where auth_user_id=auth.uid() and status='active' and role in ('admin','super_admin');
  if actor.id is null then raise exception 'Administrator access required'; end if;
  select * into prior from public.announcements where id=p_announcement_id for update;
  if prior.id is null then raise exception 'Announcement not found'; end if;
  if p_action not in ('edit','approve_recommendation','reject_recommendation','dismiss_recommendation') then raise exception 'Invalid editorial action'; end if;
  if p_action='edit' then
    if p_priority is not null and p_priority not in ('leadership','code','campus','standard') then raise exception 'Invalid priority'; end if;
    update public.announcements set priority=coalesce(p_priority,priority),is_featured=coalesce(p_is_featured,is_featured),featured_until=p_featured_until,expires_at=p_expires_at where id=prior.id;
  else
    select * into rec from public.feature_recommendations where announcement_id=prior.id and status='pending' order by created_at desc limit 1 for update;
    if rec.id is null then raise exception 'Pending recommendation not found'; end if;
    update public.feature_recommendations set status=case when p_action='approve_recommendation' then 'approved' else 'rejected' end,resolved_by=actor.id,resolved_at=now() where id=rec.id;
    if p_action='approve_recommendation' then update public.announcements set is_featured=true where id=prior.id; end if;
  end if;
  insert into public.audit_events(content_type,content_id,actor_type,actor_id,action,changes) values('announcement',prior.id,'administrator',actor.id,'announcement_'||p_action,jsonb_build_object('priority',p_priority,'is_featured',p_is_featured,'featured_until',p_featured_until,'expires_at',p_expires_at));
  return jsonb_build_object('ok',true,'action',p_action);
end $$;
revoke all on function public.manage_announcement_editorial(uuid,text,text,boolean,date,date) from public,anon;
grant execute on function public.manage_announcement_editorial(uuid,text,text,boolean,date,date) to authenticated;

create or replace function public.get_feature_recommendations()
returns table(id uuid,announcement_id uuid,announcement_title text,reviewer_name text,created_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
  select r.id,r.announcement_id,a.title,coalesce(u.full_name,u.email),r.created_at
  from public.feature_recommendations r join public.announcements a on a.id=r.announcement_id join public.user_roles u on u.id=r.requested_by
  where public.is_admin() and r.status='pending' order by r.created_at desc;
$$;
revoke all on function public.get_feature_recommendations() from public,anon;
grant execute on function public.get_feature_recommendations() to authenticated;
commit;
