begin;

alter table public.events add column if not exists home_visible boolean not null default true;
alter table public.events add column if not exists home_rank smallint;
alter table public.events drop constraint if exists events_home_rank_check;
alter table public.events add constraint events_home_rank_check check (home_rank is null or home_rank between 1 and 99);

create or replace function public.manage_home_event(p_event_id uuid,p_visible boolean,p_rank smallint default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor public.user_roles; current_status text;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  select * into actor from public.user_roles where auth_user_id=auth.uid() and status='active';
  select status into current_status from public.events where id=p_event_id for update;
  if current_status is null then raise exception 'Event not found'; end if;
  if current_status <> 'published' then raise exception 'Only published events can appear on Home'; end if;
  update public.events set home_visible=p_visible,home_rank=case when p_visible then coalesce(p_rank,99) else null end where id=p_event_id;
  insert into public.audit_events(content_type,content_id,actor_type,actor_id,action,changes)
    values('event',p_event_id,'administrator',actor.id,'home_event_updated',jsonb_build_object('home_visible',p_visible,'home_rank',case when p_visible then coalesce(p_rank,99) else null end));
  return jsonb_build_object('ok',true,'home_visible',p_visible,'home_rank',case when p_visible then coalesce(p_rank,99) else null end);
end
$$;
revoke all on function public.manage_home_event(uuid,boolean,smallint) from public,anon;
grant execute on function public.manage_home_event(uuid,boolean,smallint) to authenticated;

create or replace function public.manage_home_spotlight(p_content_type text,p_content_id uuid,p_is_featured boolean,p_rank smallint default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare table_name text; actor public.user_roles; current_status text; current_featured boolean; featured_count integer;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  table_name:=case p_content_type when 'opportunity' then 'opportunities' when 'event' then 'events' when 'announcement' then 'announcements' end;
  if table_name is null then raise exception 'Invalid content type'; end if;
  execute format('select status,is_featured from public.%I where id=$1 for update',table_name) into current_status,current_featured using p_content_id;
  if current_status is null then raise exception 'Content not found'; end if;
  if p_is_featured and current_status <> 'published' then raise exception 'Only published content can be featured'; end if;
  if p_is_featured and not current_featured then
    select (select count(*) from public.opportunities where status='published' and is_featured)
      +(select count(*) from public.events where status='published' and is_featured)
      +(select count(*) from public.announcements where status='published' and is_featured) into featured_count;
    if featured_count >= 5 then raise exception 'Home Spotlight is limited to 5 items. Remove one before adding another.'; end if;
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

create or replace function public.hard_delete_content(p_content_type text,p_content_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare table_name text; actor public.user_roles; snapshot jsonb;
begin
  if not public.is_super_admin() then raise exception 'Super Admin access required'; end if;
  if length(trim(coalesce(p_reason,''))) < 10 then raise exception 'A deletion reason of at least 10 characters is required'; end if;
  table_name:=case p_content_type when 'opportunity' then 'opportunities' when 'event' then 'events' when 'announcement' then 'announcements' end;
  if table_name is null then raise exception 'Invalid content type'; end if;
  select * into actor from public.user_roles where auth_user_id=auth.uid() and status='active';
  execute format('select to_jsonb(t) from public.%I t where id=$1 for update',table_name) into snapshot using p_content_id;
  if snapshot is null then raise exception 'Content not found'; end if;
  execute format('delete from public.%I where id=$1',table_name) using p_content_id;
  insert into public.audit_events(content_type,content_id,actor_type,actor_id,action,previous_status,new_status,reason,changes)
    values(p_content_type,p_content_id,'administrator',actor.id,'content_hard_deleted',snapshot->>'status','hard_deleted',trim(p_reason),jsonb_build_object('record_snapshot',snapshot));
  return jsonb_build_object('ok',true,'content_id',p_content_id);
end
$$;
revoke all on function public.hard_delete_content(text,uuid,text) from public,anon,authenticated;
grant execute on function public.hard_delete_content(text,uuid,text) to authenticated;

create or replace function public.update_my_display_name(p_full_name text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor public.user_roles; cleaned text:=trim(coalesce(p_full_name,''));
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if length(cleaned) < 2 or length(cleaned) > 120 then raise exception 'Full name must be between 2 and 120 characters'; end if;
  update public.user_roles set full_name=cleaned where auth_user_id=auth.uid() and status='active' returning * into actor;
  if actor.id is null then raise exception 'Active workspace role required'; end if;
  insert into public.audit_events(content_type,actor_type,actor_id,action,changes)
    values('system','administrator',actor.id,'display_name_updated',jsonb_build_object('full_name',cleaned));
  return jsonb_build_object('ok',true,'full_name',cleaned);
end
$$;
revoke all on function public.update_my_display_name(text) from public,anon;
grant execute on function public.update_my_display_name(text) to authenticated;

commit;
