-- Submission workflow support only: contributor-facing status, safe rejection
-- dismissal, and structured relationship context. Dismissal hides a rejected
-- item from the contributor dashboard without deleting content or audit history.

alter table public.intake_sessions
  add column if not exists relationship_details jsonb not null default '{}'::jsonb;

create table if not exists public.submission_dashboard_dismissals (
  user_role_id uuid not null references public.user_roles(id) on delete cascade,
  content_type text not null check (content_type in ('event','opportunity','announcement')),
  content_id uuid not null,
  dismissed_at timestamptz not null default now(),
  primary key (user_role_id, content_type, content_id)
);

alter table public.submission_dashboard_dismissals enable row level security;
revoke all on public.submission_dashboard_dismissals from public, anon, authenticated;

create or replace function public.get_my_submission_status()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.user_roles;
  result jsonb;
begin
  select * into actor from public.user_roles
  where auth_user_id=auth.uid() and status='active'
  order by case role when 'super_admin' then 1 when 'admin' then 2 when 'reviewer' then 3 else 4 end
  limit 1;
  if actor.id is null then raise exception 'Active contributor role required'; end if;

  with submissions as (
    select 'event'::text content_type,e.id content_id,e.title,e.status,e.updated_at,
      jsonb_build_object('title',e.title,'org',e.org,'date',e.date,'end_date',e.end_date,'time',e.time,'location',e.location,'description',e.description,'registration_link',e.registration_link,'contact_name',e.contact_name,'contact_email',e.contact_email) editable
    from public.events e where e.submitted_by=actor.id
    union all
    select 'opportunity',o.id,o.title,o.status,o.updated_at,
      jsonb_build_object('title',o.title,'org',o.org,'deadline',o.deadline,'location',o.location,'description',o.description,'eligibility',o.eligibility,'link',o.link,'contact_name',o.contact_name,'contact_email',o.contact_email)
    from public.opportunities o where o.submitted_by=actor.id
    union all
    select 'announcement',a.id,a.title,a.status,a.updated_at,
      jsonb_build_object('title',a.title,'source',a.source,'body',a.body,'source_url',a.source_url,'category',a.category)
    from public.announcements a where a.submitted_by=actor.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'content_type',s.content_type,'content_id',s.content_id,'title',s.title,
    'status',s.status,'updated_at',s.updated_at,'reviewer_note',e.reviewer_notes,
    'editable',s.editable
  ) order by s.updated_at desc),'[]'::jsonb) into result
  from submissions s
  left join lateral (
    select reviewer_notes from public.review_verification_evidence r
    where r.content_type=s.content_type and r.content_id=s.content_id
      and r.decision in ('needs_correction','rejected')
    order by r.updated_at desc limit 1
  ) e on true
  left join public.submission_dashboard_dismissals d
    on d.user_role_id=actor.id and d.content_type=s.content_type and d.content_id=s.content_id
  where d.content_id is null;
  return result;
end;
$$;

create or replace function public.dismiss_own_submission(p_content_type text,p_content_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare actor public.user_roles; owns_rejected boolean := false;
begin
  if p_content_type not in ('event','opportunity','announcement') then raise exception 'Invalid content type'; end if;
  select * into actor from public.user_roles where auth_user_id=auth.uid() and status='active' order by case role when 'super_admin' then 1 when 'admin' then 2 when 'reviewer' then 3 else 4 end limit 1;
  if actor.id is null then raise exception 'Active contributor role required'; end if;
  if p_content_type='event' then select exists(select 1 from public.events where id=p_content_id and submitted_by=actor.id and status='rejected') into owns_rejected;
  elsif p_content_type='opportunity' then select exists(select 1 from public.opportunities where id=p_content_id and submitted_by=actor.id and status='rejected') into owns_rejected;
  else select exists(select 1 from public.announcements where id=p_content_id and submitted_by=actor.id and status='rejected') into owns_rejected;
  end if;
  if not owns_rejected then raise exception 'Only your rejected submission can be dismissed'; end if;
  insert into public.submission_dashboard_dismissals(user_role_id,content_type,content_id)
  values(actor.id,p_content_type,p_content_id) on conflict do nothing;
  return jsonb_build_object('ok',true);
end;
$$;

revoke all on function public.get_my_submission_status() from public,anon;
revoke all on function public.dismiss_own_submission(text,uuid) from public,anon;
grant execute on function public.get_my_submission_status() to authenticated;
grant execute on function public.dismiss_own_submission(text,uuid) to authenticated;
