-- Repair super-admin submission access discovered during hosted mobile UAT.
-- This preserves the existing RBAC model and only aligns the intake policy
-- with is_verified_contributor(), which already includes super_admin.

begin;

drop policy if exists "owners create intake sessions" on public.intake_sessions;
create policy "owners create intake sessions"
on public.intake_sessions
for insert
to authenticated
with check (
  submitter_id in (
    select id
    from public.user_roles
    where auth_user_id = auth.uid()
      and status = 'active'
      and role in ('contributor', 'reviewer', 'admin', 'super_admin')
  )
);

create or replace function public.save_intake_parser_feedback(
  p_intake_session_id uuid,
  p_rating text,
  p_issue_fields text[] default '{}',
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
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
    and role in ('contributor', 'reviewer', 'admin', 'super_admin')
  limit 1;

  if actor.id is null then raise exception 'Active contributor access required'; end if;

  select * into owned_session
  from public.intake_sessions
  where id = p_intake_session_id and submitter_id = actor.id and state = 'submitted';

  if owned_session.id is null then raise exception 'Submitted intake session not found'; end if;
  if p_rating not in ('accurate', 'minor_edits', 'major_edits', 'failed') then raise exception 'Invalid parser feedback rating'; end if;

  select coalesce(array_agg(distinct issue), '{}'::text[])
  into cleaned_issues
  from unnest(coalesce(p_issue_fields, '{}'::text[])) issue
  where issue = any(array['title','date','time','location','organization','contact','deadline','source_link','description','other']::text[]);

  if cardinality(cleaned_issues) <> cardinality(coalesce(p_issue_fields, '{}'::text[])) then raise exception 'Invalid parser feedback issue field'; end if;

  insert into public.intake_parser_feedback(intake_session_id, rating, issue_fields, note)
  values (p_intake_session_id, p_rating, cleaned_issues, nullif(left(trim(coalesce(p_note, '')), 500), ''))
  on conflict (intake_session_id) do update
  set rating=excluded.rating, issue_fields=excluded.issue_fields, note=excluded.note, updated_at=now();

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.save_intake_parser_feedback(uuid,text,text[],text) from public,anon;
grant execute on function public.save_intake_parser_feedback(uuid,text,text[],text) to authenticated;

commit;
