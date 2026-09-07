-- ONE-TIME OWNER-CONTROLLED BOOTSTRAP
--
-- Run only after the canonical migrations and after the intended owner has
-- completed Supabase email authentication. This script refuses to run if an
-- active super administrator already exists. Subsequent role changes must use
-- the normal application/RPC workflow.
--
-- Example (provide the database URL securely; do not commit it):
--   psql "$DATABASE_URL" -v bootstrap_email='owner@example.edu' \
--     -f supabase/bootstrap/first_super_admin.sql

\set ON_ERROR_STOP on

\if :{?bootstrap_email}
\else
  \echo 'bootstrap_email is required'
  \quit 3
\endif

begin;

select set_config(
  'code.bootstrap_email',
  lower(trim(:'bootstrap_email')),
  true
);

do $bootstrap$
declare
  target_email text := current_setting('code.bootstrap_email', true);
  target_auth_user auth.users%rowtype;
  provisioned public.user_roles;
begin
  if target_email is null
    or target_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  then
    raise exception 'A valid bootstrap_email is required';
  end if;

  if exists (
    select 1 from public.user_roles
    where role = 'super_admin' and status = 'active'
  ) then
    raise exception 'Bootstrap refused: an active super administrator already exists';
  end if;

  select * into target_auth_user
  from auth.users
  where lower(trim(email)) = target_email
    and email_confirmed_at is not null;

  if not found then
    raise exception 'Bootstrap refused: no confirmed Auth user matches the supplied email';
  end if;

  insert into public.user_roles(email, auth_user_id, role, status)
  values(target_email, target_auth_user.id, 'super_admin', 'active')
  on conflict(email) do update
    set auth_user_id = excluded.auth_user_id,
        role = 'super_admin',
        status = 'active'
    where public.user_roles.auth_user_id is null
       or public.user_roles.auth_user_id = excluded.auth_user_id
  returning * into provisioned;

  if provisioned.id is null then
    raise exception 'Bootstrap refused: the email role is bound to another Auth identity';
  end if;

  insert into public.audit_events(
    content_type,
    actor_type,
    actor_id,
    action,
    changes
  ) values (
    'system',
    'administrator',
    provisioned.id,
    'initial_super_admin_bootstrapped',
    jsonb_build_object(
      'target_role_id', provisioned.id,
      'auth_user_id', target_auth_user.id,
      'owner_controlled', true
    )
  );
end
$bootstrap$;

commit;
