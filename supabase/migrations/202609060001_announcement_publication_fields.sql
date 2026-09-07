begin;

alter table public.announcements
  add column if not exists category text,
  add column if not exists source_url text,
  add column if not exists published_at timestamptz;

update public.announcements
set category = case
  when lower(source) like '%c.o.d.e%' or lower(source) = 'code' then 'C.O.D.E.'
  when lower(source) like '%college of engineering%' then 'College'
  when lower(source) like '%department%' then 'Department'
  else 'General'
end
where category is null;

update public.announcements
set published_at = created_at
where status = 'published' and published_at is null;

alter table public.announcements alter column category set default 'General';
alter table public.announcements alter column category set not null;
alter table public.announcements drop constraint if exists announcements_category_check;
alter table public.announcements add constraint announcements_category_check
  check (category in ('College','C.O.D.E.','Department','Academic','Event','Student Organization','General'));
alter table public.announcements drop constraint if exists announcements_source_url_check;
alter table public.announcements add constraint announcements_source_url_check
  check (source_url is null or source_url ~ '^https?://');

create or replace function public.set_announcement_published_at()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    new.published_at := now();
  end if;
  return new;
end $$;

drop trigger if exists announcements_set_published_at on public.announcements;
create trigger announcements_set_published_at before update of status on public.announcements
for each row execute function public.set_announcement_published_at();

drop function if exists public.manage_announcement_editorial(uuid,text,text,boolean,date,date);
create function public.manage_announcement_editorial(
  p_announcement_id uuid,
  p_action text,
  p_priority text default null,
  p_is_featured boolean default null,
  p_featured_until date default null,
  p_expires_at date default null,
  p_category text default null,
  p_source_url text default null
)
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
    if p_category is not null and p_category not in ('College','C.O.D.E.','Department','Academic','Event','Student Organization','General') then raise exception 'Invalid category'; end if;
    if p_source_url is not null and p_source_url !~ '^https?://' then raise exception 'Invalid source URL'; end if;
    update public.announcements set priority=coalesce(p_priority,priority),is_featured=coalesce(p_is_featured,is_featured),featured_until=p_featured_until,expires_at=p_expires_at,category=coalesce(p_category,category),source_url=nullif(trim(p_source_url),'') where id=prior.id;
  else
    select * into rec from public.feature_recommendations where announcement_id=prior.id and status='pending' order by created_at desc limit 1 for update;
    if rec.id is null then raise exception 'Pending recommendation not found'; end if;
    update public.feature_recommendations set status=case when p_action='approve_recommendation' then 'approved' else 'rejected' end,resolved_by=actor.id,resolved_at=now() where id=rec.id;
    if p_action='approve_recommendation' then update public.announcements set is_featured=true where id=prior.id; end if;
  end if;
  insert into public.audit_events(content_type,content_id,actor_type,actor_id,action,changes) values('announcement',prior.id,'administrator',actor.id,'announcement_'||p_action,jsonb_build_object('priority',p_priority,'is_featured',p_is_featured,'featured_until',p_featured_until,'expires_at',p_expires_at,'category',p_category,'source_url',p_source_url));
  return jsonb_build_object('ok',true,'action',p_action);
end $$;
revoke all on function public.manage_announcement_editorial(uuid,text,text,boolean,date,date,text,text) from public,anon;
grant execute on function public.manage_announcement_editorial(uuid,text,text,boolean,date,date,text,text) to authenticated;

commit;
