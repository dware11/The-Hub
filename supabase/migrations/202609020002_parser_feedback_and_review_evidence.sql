-- Optional, privacy-minimized parser feedback and reviewer evidence metadata.
-- This migration does not make private intake artifacts public.

begin;

alter table public.field_suggestions
  add column if not exists confidence smallint check (confidence is null or confidence between 0 and 100),
  add column if not exists review_reason text;

create table public.intake_parser_feedback (
  intake_session_id uuid primary key references public.intake_sessions(id) on delete cascade,
  rating text not null check (rating in ('accurate', 'minor_edits', 'major_edits', 'failed')),
  issue_fields text[] not null default '{}'::text[],
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intake_parser_feedback_issue_fields_check check (
    issue_fields <@ array['title','date','time','location','organization','contact','deadline','source_link','description','other']::text[]
    and cardinality(issue_fields) <= 10
  )
);

alter table public.intake_parser_feedback enable row level security;
revoke all on table public.intake_parser_feedback from public, anon, authenticated;
grant select on table public.intake_parser_feedback to authenticated;

create policy "owners and reviewers read parser feedback"
on public.intake_parser_feedback for select to authenticated using (
  intake_session_id in (
    select id from public.intake_sessions
    where submitter_id in (
      select id from public.user_roles where auth_user_id = auth.uid()
    )
  ) or public.is_reviewer()
);

create or replace function public.save_intake_parser_feedback(
  p_intake_session_id uuid,
  p_rating text,
  p_issue_fields text[] default '{}'::text[],
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
  select * into actor
  from public.user_roles
  where auth_user_id = auth.uid()
    and status = 'active'
    and role in ('contributor', 'reviewer', 'admin')
  limit 1;

  if actor.id is null then
    raise exception 'Active contributor access required';
  end if;

  select * into owned_session
  from public.intake_sessions
  where id = p_intake_session_id
    and submitter_id = actor.id
    and state = 'submitted';

  if owned_session.id is null then
    raise exception 'Submitted intake session not found';
  end if;
  if p_rating not in ('accurate', 'minor_edits', 'major_edits', 'failed') then
    raise exception 'Invalid parser feedback rating';
  end if;

  select coalesce(array_agg(distinct issue), '{}'::text[])
  into cleaned_issues
  from unnest(coalesce(p_issue_fields, '{}'::text[])) issue
  where issue = any(array['title','date','time','location','organization','contact','deadline','source_link','description','other']::text[]);

  if cardinality(cleaned_issues) <> cardinality(coalesce(p_issue_fields, '{}'::text[])) then
    raise exception 'Invalid parser feedback issue field';
  end if;

  insert into public.intake_parser_feedback(intake_session_id, rating, issue_fields, note)
  values (p_intake_session_id, p_rating, cleaned_issues, nullif(left(trim(coalesce(p_note, '')), 500), ''))
  on conflict (intake_session_id) do update
    set rating = excluded.rating,
        issue_fields = excluded.issue_fields,
        note = excluded.note,
        updated_at = now();

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.save_intake_parser_feedback(uuid,text,text[],text) from public, anon;
grant execute on function public.save_intake_parser_feedback(uuid,text,text[],text) to authenticated;

create or replace function public.get_parser_feedback_metrics(p_days integer default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  if not public.is_reviewer() then
    raise exception 'Reviewer access required';
  end if;
  if p_days is not null and p_days not in (7, 30) then
    raise exception 'Unsupported metrics window';
  end if;

  with filtered as (
    select * from public.intake_parser_feedback
    where p_days is null or created_at >= now() - make_interval(days => p_days)
  ), ratings as (
    select rating, count(*)::bigint as count from filtered group by rating
  ), issues as (
    select issue, count(*)::bigint as count
    from filtered, unnest(issue_fields) issue
    group by issue
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'ratings', coalesce((select jsonb_object_agg(rating, count) from ratings), '{}'::jsonb),
    'issues', coalesce((select jsonb_object_agg(issue, count) from issues), '{}'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_parser_feedback_metrics(integer) from public, anon;
grant execute on function public.get_parser_feedback_metrics(integer) to authenticated;

commit;
