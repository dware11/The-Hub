begin;

create or replace function public.manage_home_announcement(
  p_announcement_id uuid,
  p_highlighted boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor public.user_roles;
  announcement_record public.announcements;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into actor
  from public.user_roles
  where auth_user_id = auth.uid()
    and status = 'active'
    and role in ('admin', 'super_admin');

  if actor.id is null then
    raise exception 'Administrator access required';
  end if;

  select * into announcement_record
  from public.announcements
  where id = p_announcement_id
  for update;

  if announcement_record.id is null then
    raise exception 'Announcement not found';
  end if;

  if p_highlighted and announcement_record.status <> 'published' then
    raise exception 'Only published announcements can be highlighted on the homepage';
  end if;

  if p_highlighted and announcement_record.expires_at is not null
    and announcement_record.expires_at < current_date then
    raise exception 'Expired announcements cannot be highlighted on the homepage';
  end if;

  update public.announcements
  set pinned = p_highlighted
  where id = p_announcement_id;

  insert into public.audit_events(
    content_type,
    content_id,
    actor_type,
    actor_id,
    action,
    changes
  ) values (
    'announcement',
    p_announcement_id,
    'administrator',
    actor.id,
    case when p_highlighted then 'homepage_announcement_highlighted' else 'homepage_announcement_unhighlighted' end,
    jsonb_build_object('pinned', jsonb_build_object('before', announcement_record.pinned, 'after', p_highlighted))
  );

  return jsonb_build_object('ok', true, 'highlighted', p_highlighted);
end;
$$;

revoke all on function public.manage_home_announcement(uuid, boolean) from public, anon;
grant execute on function public.manage_home_announcement(uuid, boolean) to authenticated;

commit;
