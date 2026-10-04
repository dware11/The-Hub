-- Give reviewers only the submitter identity attached to a reviewable submission.
-- This deliberately does not expose the user directory or auth identifiers.
create or replace function public.get_review_submission_identity(
  p_content_type text,
  p_content_id uuid
)
returns table(
  full_name text,
  email text,
  organization text,
  contact_name text,
  contact_email text,
  is_own_submission boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor public.user_roles;
  submitter_id uuid;
  submission_status text;
  submission_contact_name text;
  submission_contact_email text;
begin
  select * into actor
  from public.user_roles
  where auth_user_id = auth.uid()
    and status = 'active'
    and role in ('reviewer', 'admin', 'super_admin')
  order by case role when 'super_admin' then 1 when 'admin' then 2 else 3 end
  limit 1;

  if actor.id is null then
    raise exception 'Reviewer access required';
  end if;

  if p_content_type = 'opportunity' then
    select submitted_by, status, contact_name, contact_email
      into submitter_id, submission_status, submission_contact_name, submission_contact_email
    from public.opportunities
    where id = p_content_id;
  elsif p_content_type = 'event' then
    select submitted_by, status, contact_name, contact_email
      into submitter_id, submission_status, submission_contact_name, submission_contact_email
    from public.events
    where id = p_content_id;
  elsif p_content_type = 'announcement' then
    select submitted_by, status, null::text, null::text
      into submitter_id, submission_status, submission_contact_name, submission_contact_email
    from public.announcements
    where id = p_content_id;
  else
    raise exception 'Unknown content type';
  end if;

  if submitter_id is null or submission_status not in ('pending', 'resubmitted') then
    raise exception 'Submission is not available for review';
  end if;

  return query
  select
    submitter.full_name,
    submitter.email,
    submitter.org,
    submission_contact_name,
    submission_contact_email,
    submitter.id = actor.id
  from public.user_roles as submitter
  where submitter.id = submitter_id;
end;
$$;

revoke all on function public.get_review_submission_identity(text, uuid) from public;
revoke all on function public.get_review_submission_identity(text, uuid) from anon;
grant execute on function public.get_review_submission_identity(text, uuid) to authenticated;
