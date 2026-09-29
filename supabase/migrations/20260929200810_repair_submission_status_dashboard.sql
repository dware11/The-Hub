begin;

-- Content tables currently record created_at but do not have updated_at columns.
-- The prior RPC referenced those missing columns, so the server returned an empty
-- dashboard after swallowing the database error. Keep the function identity-bound
-- and expose a stable timestamp without changing stored content records.
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
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into actor
  from public.user_roles
  where auth_user_id = auth.uid() and status = 'active'
  order by case role when 'super_admin' then 1 when 'admin' then 2 when 'reviewer' then 3 else 4 end
  limit 1;

  if actor.id is null then
    raise exception 'Active contributor role required';
  end if;

  with identity_roles as (
    select id
    from public.user_roles
    where auth_user_id = auth.uid()
  ), submissions as (
    select 'event'::text content_type, e.id content_id, e.title, e.status, e.created_at,
      jsonb_build_object('title',e.title,'org',e.org,'date',e.date,'end_date',e.end_date,'time',e.time,'location',e.location,'description',e.description,'registration_link',e.registration_link,'contact_name',e.contact_name,'contact_email',e.contact_email) editable
    from public.events e where e.submitted_by in (select id from identity_roles)
    union all
    select 'opportunity', o.id, o.title, o.status, o.created_at,
      jsonb_build_object('title',o.title,'org',o.org,'deadline_type',o.deadline_type,'deadline',o.deadline,'posted_date',o.posted_date,'compensation_type',o.compensation_type,'location',o.location,'description',o.description,'eligibility',o.eligibility,'link',o.link,'contact_name',o.contact_name,'contact_email',o.contact_email)
    from public.opportunities o where o.submitted_by in (select id from identity_roles)
    union all
    select 'announcement', a.id, a.title, a.status, a.created_at,
      jsonb_build_object('title',a.title,'source',a.source,'body',a.body,'source_url',a.source_url,'category',a.category)
    from public.announcements a where a.submitted_by in (select id from identity_roles)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'content_type',s.content_type,
    'content_id',s.content_id,
    'title',s.title,
    'status',s.status,
    'created_at',s.created_at,
    'updated_at',s.created_at,
    'reviewer_note',e.reviewer_notes,
    'editable',s.editable
  ) order by s.created_at desc), '[]'::jsonb)
  into result
  from submissions s
  left join lateral (
    select reviewer_notes
    from public.review_verification_evidence r
    where r.content_type = s.content_type
      and r.content_id = s.content_id
      and r.decision in ('needs_correction','rejected')
    order by r.updated_at desc
    limit 1
  ) e on true
  where not exists (
    select 1
    from public.submission_dashboard_dismissals d
    where d.user_role_id in (select id from identity_roles)
      and d.content_type = s.content_type
      and d.content_id = s.content_id
  );

  return result;
end;
$$;

revoke all on function public.get_my_submission_status() from public, anon;
grant execute on function public.get_my_submission_status() to authenticated;

comment on function public.get_my_submission_status() is
  'Returns submission title, status, timestamps, reviewer note, and editable values for the authenticated Hub identity.';

commit;
