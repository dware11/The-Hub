begin;

alter table public.events
  add column if not exists end_date date,
  add constraint events_end_date_not_before_start
    check (end_date is null or end_date >= date);

alter table public.source_artifacts
  add column if not exists source_text text
    check (source_text is null or char_length(source_text) <= 50000);

update storage.buckets
set public = false,
    file_size_limit = 15728640,
    allowed_mime_types = array['application/pdf','image/png','image/jpeg']
where id = 'intake-sources';

create table public.issue_reports (
  id uuid primary key default gen_random_uuid(),
  issue_type text not null check (issue_type in (
    'Broken link', 'Wrong date/deadline', 'Wrong information', 'Duplicate',
    'Event canceled/changed', 'Sign-in issue', 'Submission issue',
    'Calendar/display issue', 'Page error', 'Accessibility issue', 'Other'
  )),
  content_type text check (content_type is null or content_type in ('opportunity','event')),
  content_id uuid,
  page_url text not null check (char_length(page_url) between 1 and 2048),
  description text not null check (char_length(trim(description)) between 1 and 3000),
  reporter_email text check (reporter_email is null or char_length(reporter_email) <= 320),
  status text not null default 'open' check (status in ('open','in_review','resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint issue_reports_content_pair check (
    (content_type is null and content_id is null)
    or (content_type is not null and content_id is not null)
  ),
  constraint issue_reports_resolution_consistent check (
    (status = 'resolved' and resolved_at is not null)
    or (status <> 'resolved' and resolved_at is null)
  )
);

alter table public.issue_reports enable row level security;

create policy "anyone creates open issue reports"
  on public.issue_reports for insert
  to anon, authenticated
  with check (status = 'open' and resolved_at is null);

create policy "admins read issue reports"
  on public.issue_reports for select
  to authenticated
  using (public.is_admin());

create policy "admins update issue reports"
  on public.issue_reports for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all privileges on table public.issue_reports from public, anon, authenticated;
grant insert on table public.issue_reports to anon, authenticated;
grant select, update on table public.issue_reports to authenticated;

create index issue_reports_status_created_idx
  on public.issue_reports(status, created_at desc);

create or replace function public.manage_published_content(p_content_type text,p_content_id uuid,p_action text,p_changes jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t text; current_status text; actor public.user_roles; prior text; next_start date; next_end date;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if p_action not in ('edit','unpublish','archive','soft_delete','restore') then raise exception 'Invalid content action'; end if;
  t:=case p_content_type when 'opportunity' then 'opportunities' when 'event' then 'events' when 'announcement' then 'announcements' end;
  if t is null then raise exception 'Invalid content type'; end if;
  execute format('select status from public.%I where id=$1 for update',t) into current_status using p_content_id;
  if current_status is null then raise exception 'Content not found'; end if;
  select * into actor from public.user_roles where auth_user_id=auth.uid() and status='active';
  if p_action='edit' then
    if current_status='deleted' then raise exception 'Restore deleted content before editing'; end if;
    if p_content_type='announcement' then
      update public.announcements set title=case when p_changes?'title' then left(trim(p_changes->>'title'),240) else title end,body=case when p_changes?'description' then left(trim(p_changes->>'description'),5000) else body end,source=case when p_changes?'organization' then left(trim(p_changes->>'organization'),240) else source end where id=p_content_id;
    elsif p_content_type='event' then
      select coalesce(nullif(p_changes->>'start_date','')::date,date),case when p_changes?'end_date' then nullif(p_changes->>'end_date','')::date else end_date end into next_start,next_end from public.events where id=p_content_id;
      if next_end is not null and next_end < next_start then raise exception 'Event end date cannot be before the start date'; end if;
      update public.events set title=case when p_changes?'title' then left(trim(p_changes->>'title'),240) else title end,description=case when p_changes?'description' then left(trim(p_changes->>'description'),5000) else description end,org=case when p_changes?'organization' then left(trim(p_changes->>'organization'),240) else org end,registration_link=case when p_changes?'source_url' then nullif(left(trim(p_changes->>'source_url'),2000),'') else registration_link end,date=next_start,end_date=next_end where id=p_content_id;
    else
      update public.opportunities set title=case when p_changes?'title' then left(trim(p_changes->>'title'),240) else title end,description=case when p_changes?'description' then left(trim(p_changes->>'description'),5000) else description end,org=case when p_changes?'organization' then left(trim(p_changes->>'organization'),240) else org end,link=case when p_changes?'source_url' then nullif(left(trim(p_changes->>'source_url'),2000),'') else link end where id=p_content_id;
    end if;
  elsif p_action='unpublish' then
    if current_status<>'published' then raise exception 'Only published content can be unpublished'; end if;
    execute format('update public.%I set status=''unpublished'' where id=$1',t) using p_content_id;
  elsif p_action='archive' then
    if current_status not in ('published','unpublished') then raise exception 'Only published or unpublished content can be archived'; end if;
    execute format('update public.%I set status=''archived'' where id=$1',t) using p_content_id;
  elsif p_action='soft_delete' then
    if current_status='deleted' then raise exception 'Content is already deleted'; end if;
    execute format('update public.%I set deleted_previous_status=status,status=''deleted'',deleted_at=now(),deleted_by=$1 where id=$2',t) using actor.id,p_content_id;
  else
    if current_status<>'deleted' then raise exception 'Only deleted content can be restored'; end if;
    execute format('select coalesce(deleted_previous_status,''unpublished'') from public.%I where id=$1',t) into prior using p_content_id;
    execute format('update public.%I set status=$1,deleted_at=null,deleted_by=null,deleted_previous_status=null where id=$2',t) using prior,p_content_id;
  end if;
  insert into public.audit_events(content_type,content_id,actor_type,actor_id,action,previous_status,new_status,changes)
    values(p_content_type,p_content_id,'administrator',actor.id,'content_'||p_action,current_status,case when p_action='edit' then current_status when p_action='unpublish' then 'unpublished' when p_action='archive' then 'archived' when p_action='soft_delete' then 'deleted' else prior end,case when p_action='edit' then p_changes else '{}'::jsonb end);
  return jsonb_build_object('ok',true,'action',p_action,'content_id',p_content_id);
end
$$;
revoke all on function public.manage_published_content(text,uuid,text,jsonb) from public,anon;
grant execute on function public.manage_published_content(text,uuid,text,jsonb) to authenticated;

commit;
