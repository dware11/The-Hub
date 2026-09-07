begin;

alter table public.opportunities add column if not exists is_featured boolean not null default false;
alter table public.opportunities add column if not exists spotlight_rank smallint;
alter table public.events add column if not exists is_featured boolean not null default false;
alter table public.events add column if not exists spotlight_rank smallint;
alter table public.announcements add column if not exists spotlight_rank smallint;

alter table public.opportunities add constraint opportunities_spotlight_rank_check check (spotlight_rank is null or spotlight_rank between 1 and 99);
alter table public.events add constraint events_spotlight_rank_check check (spotlight_rank is null or spotlight_rank between 1 and 99);
alter table public.announcements add constraint announcements_spotlight_rank_check check (spotlight_rank is null or spotlight_rank between 1 and 99);

create or replace function public.manage_home_spotlight(p_content_type text,p_content_id uuid,p_is_featured boolean,p_rank smallint default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor public.user_roles; table_name text; current_status text;
begin
  select * into actor from public.user_roles where auth_user_id=auth.uid() and status='active' and role in ('admin','super_admin');
  if actor.id is null then raise exception 'Administrator access required'; end if;
  table_name := case p_content_type when 'opportunity' then 'opportunities' when 'event' then 'events' when 'announcement' then 'announcements' else null end;
  if table_name is null then raise exception 'Invalid content type'; end if;
  if p_rank is not null and (p_rank < 1 or p_rank > 99) then raise exception 'Spotlight rank must be between 1 and 99'; end if;
  execute format('select status from %I where id=$1 for update',table_name) into current_status using p_content_id;
  if current_status is null then raise exception 'Content not found'; end if;
  if p_is_featured and current_status <> 'published' then raise exception 'Only published content can be featured'; end if;
  execute format('update %I set is_featured=$1,spotlight_rank=$2 where id=$3',table_name) using p_is_featured,case when p_is_featured then coalesce(p_rank,99) else null end,p_content_id;
  insert into public.audit_events(content_type,content_id,actor_type,actor_id,action,changes) values(p_content_type,p_content_id,'administrator',actor.id,case when p_is_featured then 'home_spotlight_added' else 'home_spotlight_removed' end,jsonb_build_object('is_featured',p_is_featured,'spotlight_rank',p_rank));
  return jsonb_build_object('ok',true,'is_featured',p_is_featured,'spotlight_rank',case when p_is_featured then coalesce(p_rank,99) else null end);
end $$;
revoke all on function public.manage_home_spotlight(text,uuid,boolean,smallint) from public,anon;
grant execute on function public.manage_home_spotlight(text,uuid,boolean,smallint) to authenticated;

commit;
