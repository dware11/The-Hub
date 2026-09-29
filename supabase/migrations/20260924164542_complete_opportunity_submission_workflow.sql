begin;

alter table public.opportunities
  alter column deadline drop not null,
  add column if not exists deadline_type text not null default 'specific_date';

alter table public.opportunities
  drop constraint if exists opportunities_deadline_type_check,
  add constraint opportunities_deadline_type_check
    check (deadline_type in ('specific_date', 'rolling', 'no_deadline', 'not_provided')),
  drop constraint if exists opportunities_deadline_state_check,
  add constraint opportunities_deadline_state_check
    check (
      (deadline_type = 'specific_date' and deadline is not null)
      or (deadline_type <> 'specific_date' and deadline is null)
    );

create or replace function public.enforce_v1_home_content_state()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status <> 'published' then
    new.is_featured := false;
    new.spotlight_rank := null;
  end if;
  return new;
end
$$;

create or replace function public.enforce_v1_announcement_home_state()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare active_pinned integer;
begin
  if new.status <> 'published' then
    new.is_featured := false;
    new.spotlight_rank := null;
    new.pinned := false;
  end if;

  if new.status = 'published'
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

drop trigger if exists announcements_v1_home_state on public.announcements;
create trigger announcements_v1_home_state
before insert or update on public.announcements
for each row execute function public.enforce_v1_announcement_home_state();

revoke all on function public.enforce_v1_home_content_state() from public, anon, authenticated;
revoke all on function public.enforce_v1_announcement_home_state() from public, anon, authenticated;

comment on column public.opportunities.deadline_type is
  'specific_date, rolling, no_deadline, or not_provided; non-specific states store a null deadline.';

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
      jsonb_build_object('title',o.title,'org',o.org,'deadline_type',o.deadline_type,'deadline',o.deadline,'location',o.location,'description',o.description,'eligibility',o.eligibility,'link',o.link,'contact_name',o.contact_name,'contact_email',o.contact_email)
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

commit;
