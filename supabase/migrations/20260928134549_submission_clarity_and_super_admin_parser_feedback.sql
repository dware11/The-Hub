begin;

alter table public.opportunities
  add column if not exists posted_date date,
  alter column contact_name drop not null,
  alter column contact_email drop not null;

comment on column public.opportunities.posted_date is
  'Original source posting date, used to explain urgency for Apply ASAP opportunities.';

drop policy if exists "owners and reviewers read parser feedback" on public.intake_parser_feedback;
create policy "super admins read parser feedback"
on public.intake_parser_feedback for select to authenticated
using (public.is_super_admin());

create or replace function public.save_intake_parser_feedback(
  p_intake_session_id uuid,
  p_rating text,
  p_issue_fields text[] default '{}',
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor public.user_roles;
  owned_session public.intake_sessions;
  cleaned_issues text[];
begin
  select * into actor from public.user_roles
  where auth_user_id = auth.uid() and status = 'active' and role = 'super_admin'
  limit 1;
  if actor.id is null then raise exception 'Super Admin access required'; end if;

  select * into owned_session from public.intake_sessions
  where id = p_intake_session_id and submitter_id = actor.id and state = 'submitted';
  if owned_session.id is null then raise exception 'Submitted intake session not found'; end if;
  if p_rating not in ('accurate', 'minor_edits', 'major_edits', 'failed') then raise exception 'Invalid parser feedback rating'; end if;

  select coalesce(array_agg(distinct issue), '{}'::text[]) into cleaned_issues
  from unnest(coalesce(p_issue_fields, '{}'::text[])) issue
  where issue = any(array['title','date','time','location','organization','contact','deadline','source_link','description','other']::text[]);
  if cardinality(cleaned_issues) <> cardinality(coalesce(p_issue_fields, '{}'::text[])) then raise exception 'Invalid parser feedback issue field'; end if;

  insert into public.intake_parser_feedback(intake_session_id, rating, issue_fields, note)
  values (p_intake_session_id, p_rating, cleaned_issues, nullif(left(trim(coalesce(p_note, '')), 500), ''))
  on conflict (intake_session_id) do update set rating = excluded.rating, issue_fields = excluded.issue_fields, note = excluded.note, updated_at = now();
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.save_intake_parser_feedback(uuid,text,text[],text) from public, anon;
grant execute on function public.save_intake_parser_feedback(uuid,text,text[],text) to authenticated;

create or replace function public.get_parser_feedback_metrics(p_days integer default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare result jsonb;
begin
  if not public.is_super_admin() then raise exception 'Super Admin access required'; end if;
  if p_days is not null and p_days not in (7, 30) then raise exception 'Unsupported metrics window'; end if;
  with filtered as (select * from public.intake_parser_feedback where p_days is null or created_at >= now() - make_interval(days => p_days)),
  ratings as (select rating, count(*)::bigint as count from filtered group by rating),
  issues as (select issue, count(*)::bigint as count from filtered, unnest(issue_fields) issue group by issue)
  select jsonb_build_object('total', (select count(*) from filtered), 'ratings', coalesce((select jsonb_object_agg(rating, count) from ratings), '{}'::jsonb), 'issues', coalesce((select jsonb_object_agg(issue, count) from issues), '{}'::jsonb)) into result;
  return result;
end;
$$;

revoke all on function public.get_parser_feedback_metrics(integer) from public, anon;
grant execute on function public.get_parser_feedback_metrics(integer) to authenticated;

create or replace function public.get_my_submission_status()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare actor public.user_roles; result jsonb;
begin
  select * into actor from public.user_roles where auth_user_id = auth.uid() and status = 'active' order by case role when 'super_admin' then 1 when 'admin' then 2 when 'reviewer' then 3 else 4 end limit 1;
  if actor.id is null then raise exception 'Active contributor role required'; end if;
  with submissions as (
    select 'event'::text content_type, e.id content_id, e.title, e.status, e.created_at, e.updated_at,
      jsonb_build_object('title',e.title,'org',e.org,'date',e.date,'end_date',e.end_date,'time',e.time,'location',e.location,'description',e.description,'registration_link',e.registration_link,'contact_name',e.contact_name,'contact_email',e.contact_email) editable
    from public.events e where e.submitted_by = actor.id
    union all
    select 'opportunity', o.id, o.title, o.status, o.created_at, o.updated_at,
      jsonb_build_object('title',o.title,'org',o.org,'deadline_type',o.deadline_type,'deadline',o.deadline,'posted_date',o.posted_date,'compensation_type',o.compensation_type,'location',o.location,'description',o.description,'eligibility',o.eligibility,'link',o.link,'contact_name',o.contact_name,'contact_email',o.contact_email)
    from public.opportunities o where o.submitted_by = actor.id
    union all
    select 'announcement', a.id, a.title, a.status, a.created_at, a.updated_at,
      jsonb_build_object('title',a.title,'source',a.source,'body',a.body,'source_url',a.source_url,'category',a.category)
    from public.announcements a where a.submitted_by = actor.id
  )
  select coalesce(jsonb_agg(jsonb_build_object('content_type',s.content_type,'content_id',s.content_id,'title',s.title,'status',s.status,'created_at',s.created_at,'updated_at',s.updated_at,'reviewer_note',e.reviewer_notes,'editable',s.editable) order by s.updated_at desc), '[]'::jsonb) into result
  from submissions s
  left join lateral (select reviewer_notes from public.review_verification_evidence r where r.content_type = s.content_type and r.content_id = s.content_id and r.decision in ('needs_correction','rejected') order by r.updated_at desc limit 1) e on true
  left join public.submission_dashboard_dismissals d on d.user_role_id = actor.id and d.content_type = s.content_type and d.content_id = s.content_id
  where d.content_id is null;
  return result;
end;
$$;

revoke all on function public.get_my_submission_status() from public, anon;
grant execute on function public.get_my_submission_status() to authenticated;

commit;
