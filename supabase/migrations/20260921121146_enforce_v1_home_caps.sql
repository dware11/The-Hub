begin;

create or replace function public.enforce_v1_home_content_state()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare active_pinned integer;
begin
  if new.status <> 'published' then
    new.is_featured := false;
    new.spotlight_rank := null;
    if tg_table_name = 'announcements' then new.pinned := false; end if;
  end if;

  if tg_table_name = 'announcements'
    and new.status = 'published'
    and new.pinned
    and (new.expires_at is null or new.expires_at >= current_date)
    and (tg_op = 'INSERT' or old.pinned is distinct from true or old.status is distinct from 'published') then
    perform pg_advisory_xact_lock(hashtextextended('code-home-announcement-cap', 0));
    select count(*) into active_pinned
    from public.announcements
    where status = 'published'
      and pinned
      and (expires_at is null or expires_at >= current_date)
      and id <> new.id;
    if active_pinned >= 7 then
      raise exception 'The homepage announcement area is limited to 7 active items. Remove or unpin one before adding another.';
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists opportunities_v1_home_state on public.opportunities;
create trigger opportunities_v1_home_state before insert or update on public.opportunities
for each row execute function public.enforce_v1_home_content_state();
drop trigger if exists events_v1_home_state on public.events;
create trigger events_v1_home_state before insert or update on public.events
for each row execute function public.enforce_v1_home_content_state();
drop trigger if exists announcements_v1_home_state on public.announcements;
create trigger announcements_v1_home_state before insert or update on public.announcements
for each row execute function public.enforce_v1_home_content_state();

create or replace function public.manage_home_spotlight(p_content_type text,p_content_id uuid,p_is_featured boolean,p_rank smallint default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare table_name text; actor public.user_roles; current_status text; current_featured boolean; featured_count integer;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  table_name:=case p_content_type when 'opportunity' then 'opportunities' when 'event' then 'events' when 'announcement' then 'announcements' end;
  if table_name is null then raise exception 'Invalid content type'; end if;
  perform pg_advisory_xact_lock(hashtextextended('code-home-spotlight-cap', 0));
  execute format('select status,is_featured from public.%I where id=$1 for update',table_name) into current_status,current_featured using p_content_id;
  if current_status is null then raise exception 'Content not found'; end if;
  if p_is_featured and current_status <> 'published' then raise exception 'Only published content can be featured'; end if;
  if p_is_featured and not current_featured then
    select (select count(*) from public.opportunities where status='published' and is_featured)
      +(select count(*) from public.events where status='published' and is_featured)
      +(select count(*) from public.announcements where status='published' and is_featured) into featured_count;
    if featured_count >= 3 then raise exception 'Home Spotlight is limited to 3 active items. Remove one before adding another.'; end if;
  end if;
  select * into actor from public.user_roles where auth_user_id=auth.uid() and status='active';
  execute format('update public.%I set is_featured=$1,spotlight_rank=$2 where id=$3',table_name)
    using p_is_featured,case when p_is_featured then coalesce(p_rank,99) else null end,p_content_id;
  insert into public.audit_events(content_type,content_id,actor_type,actor_id,action,changes)
    values(p_content_type,p_content_id,'administrator',actor.id,case when p_is_featured then 'home_spotlight_updated' else 'home_spotlight_removed' end,jsonb_build_object('is_featured',p_is_featured,'spotlight_rank',case when p_is_featured then coalesce(p_rank,99) else null end));
  return jsonb_build_object('ok',true,'is_featured',p_is_featured,'spotlight_rank',case when p_is_featured then coalesce(p_rank,99) else null end);
end
$$;

revoke all on function public.manage_home_spotlight(text,uuid,boolean,smallint) from public,anon;
grant execute on function public.manage_home_spotlight(text,uuid,boolean,smallint) to authenticated;

commit;
