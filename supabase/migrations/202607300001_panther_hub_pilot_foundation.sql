-- Panther Hub pilot foundation.
-- Review and back up production data before applying.

begin;

-- Existing rows with null submitters must be repaired before this migration.
do $$
begin
  if exists (
    select 1 from opportunities where submitted_by is null
    union all
    select 1 from events where submitted_by is null
    union all
    select 1 from announcements where submitted_by is null
  ) then
    raise exception 'Backfill null submitted_by values before applying the pilot foundation migration.';
  end if;
end;
$$;

alter table opportunities alter column submitted_by set not null;
alter table events alter column submitted_by set not null;
alter table announcements alter column submitted_by set not null;

drop policy if exists "verified contributors can submit opportunities" on opportunities;
drop policy if exists "verified contributors can submit events" on events;
drop policy if exists "verified contributors can submit announcements" on announcements;

create policy "contributors submit own opportunities" on opportunities
  for insert with check (
    is_verified_contributor()
    and status = 'pending'
    and submitted_by in (
      select id from user_roles
      where lower(email) = lower(auth.jwt() ->> 'email')
        and status = 'active'
    )
  );

create policy "contributors submit own events" on events
  for insert with check (
    is_verified_contributor()
    and status = 'pending'
    and submitted_by in (
      select id from user_roles
      where lower(email) = lower(auth.jwt() ->> 'email')
        and status = 'active'
    )
  );

create policy "contributors submit own announcements" on announcements
  for insert with check (
    is_verified_contributor()
    and status = 'pending'
    and submitted_by in (
      select id from user_roles
      where lower(email) = lower(auth.jwt() ->> 'email')
        and status = 'active'
    )
  );

create policy "contributors read own events" on events
  for select using (
    is_verified_contributor()
    and submitted_by in (
      select id from user_roles
      where lower(email) = lower(auth.jwt() ->> 'email')
    )
  );

create policy "contributors read own announcements" on announcements
  for select using (
    is_verified_contributor()
    and submitted_by in (
      select id from user_roles
      where lower(email) = lower(auth.jwt() ->> 'email')
    )
  );

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (
    content_type in ('opportunity', 'event', 'announcement', 'digest', 'system')
  ),
  content_id uuid,
  actor_type text not null check (
    actor_type in ('contributor', 'reviewer', 'administrator', 'system', 'external_invitation')
  ),
  actor_id uuid references user_roles(id),
  action text not null,
  previous_status text,
  new_status text,
  reason text,
  changes jsonb not null default '{}'::jsonb,
  request_id text,
  created_at timestamptz not null default now()
);

alter table audit_events enable row level security;

create policy "admins read audit events" on audit_events
  for select using (is_admin());

create policy "authenticated actors append audit events" on audit_events
  for insert with check (
    actor_id in (
      select id from user_roles
      where lower(email) = lower(auth.jwt() ->> 'email')
        and status = 'active'
    )
  );

create table digest_runs (
  id uuid primary key default gen_random_uuid(),
  edition_id text unique not null,
  scheduled_for timestamptz not null,
  status text not null check (
    status in ('scheduled', 'building', 'sending', 'sent', 'failed', 'cancelled', 'superseded')
  ),
  included_content_ids jsonb not null default '[]'::jsonb,
  trigger_source text not null check (trigger_source in ('cron', 'manual', 'retry', 'replacement')),
  started_at timestamptz,
  completed_at timestamptz,
  provider_message_id text,
  retry_count integer not null default 0 check (retry_count >= 0),
  failure_details text,
  actor_id uuid references user_roles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table digest_runs enable row level security;

create policy "admins read digest runs" on digest_runs
  for select using (is_admin());

create policy "admins manage digest runs" on digest_runs
  for all using (is_admin()) with check (is_admin());

create index audit_events_content_idx
  on audit_events (content_type, content_id, created_at desc);
create index audit_events_actor_idx
  on audit_events (actor_id, created_at desc);
create index digest_runs_schedule_idx
  on digest_runs (scheduled_for desc);

commit;
