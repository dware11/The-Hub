-- Panther Hub multi-source intake and private source storage.

begin;

create table intake_sessions (
  id uuid primary key default gen_random_uuid(),
  submitter_id uuid not null references user_roles(id),
  content_type text not null check (content_type in ('event', 'opportunity', 'announcement')),
  relationship_to_source text not null check (relationship_to_source in (
    'original_contact',
    'pvamu_department_referral',
    'student_organization_referral',
    'sponsor_referral',
    'alumni_referral',
    'external_discovery',
    'other'
  )),
  referral_name text,
  referral_title text,
  referral_organization text,
  referral_email text,
  referral_may_display boolean not null default false,
  state text not null default 'draft' check (state in (
    'draft', 'processing', 'needs_confirmation', 'submitted', 'abandoned', 'failed'
  )),
  created_at timestamptz not null default now(),
  submitted_at timestamptz
);

create table source_artifacts (
  id uuid primary key default gen_random_uuid(),
  intake_session_id uuid not null references intake_sessions(id) on delete cascade,
  source_type text not null check (source_type in (
    'flyer', 'program_pdf', 'screenshot', 'email_screenshot', 'pasted_text', 'source_link', 'other'
  )),
  original_filename text,
  storage_path text,
  mime_type text,
  byte_size bigint check (byte_size is null or byte_size >= 0),
  page_count integer check (page_count is null or page_count > 0),
  source_date timestamptz,
  processing_status text not null default 'pending' check (processing_status in (
    'pending', 'uploaded', 'processing', 'processed', 'needs_review', 'failed'
  )),
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table field_suggestions (
  id uuid primary key default gen_random_uuid(),
  intake_session_id uuid not null references intake_sessions(id) on delete cascade,
  source_artifact_id uuid references source_artifacts(id) on delete set null,
  field_name text not null,
  suggested_value jsonb,
  source_text text,
  provider text not null default 'local',
  parser_version text not null,
  needs_review boolean not null default true,
  contributor_value jsonb,
  contributor_confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table opportunities add column intake_session_id uuid references intake_sessions(id);
alter table events add column intake_session_id uuid references intake_sessions(id);
alter table announcements add column intake_session_id uuid references intake_sessions(id);

alter table intake_sessions enable row level security;
alter table source_artifacts enable row level security;
alter table field_suggestions enable row level security;

create policy "contributors create own intake sessions" on intake_sessions
  for insert with check (
    submitter_id in (
      select id from user_roles
      where lower(email) = lower(auth.jwt() ->> 'email') and status = 'active'
    )
  );

create policy "contributors manage own intake sessions" on intake_sessions
  for all using (
    submitter_id in (
      select id from user_roles where lower(email) = lower(auth.jwt() ->> 'email')
    ) or is_admin()
  ) with check (
    submitter_id in (
      select id from user_roles where lower(email) = lower(auth.jwt() ->> 'email')
    ) or is_admin()
  );

create policy "contributors manage own source artifacts" on source_artifacts
  for all using (
    intake_session_id in (
      select id from intake_sessions where submitter_id in (
        select id from user_roles where lower(email) = lower(auth.jwt() ->> 'email')
      )
    ) or is_admin()
  ) with check (
    intake_session_id in (
      select id from intake_sessions where submitter_id in (
        select id from user_roles where lower(email) = lower(auth.jwt() ->> 'email')
      )
    ) or is_admin()
  );

create policy "contributors manage own field suggestions" on field_suggestions
  for all using (
    intake_session_id in (
      select id from intake_sessions where submitter_id in (
        select id from user_roles where lower(email) = lower(auth.jwt() ->> 'email')
      )
    ) or is_admin()
  ) with check (
    intake_session_id in (
      select id from intake_sessions where submitter_id in (
        select id from user_roles where lower(email) = lower(auth.jwt() ->> 'email')
      )
    ) or is_admin()
  );

insert into storage.buckets (id, name, public)
values ('intake-sources', 'intake-sources', false)
on conflict (id) do update set public = false;

create policy "verified contributors upload intake sources" on storage.objects
  for insert with check (
    bucket_id = 'intake-sources' and is_verified_contributor()
  );

create policy "owners and admins read intake sources" on storage.objects
  for select using (
    bucket_id = 'intake-sources' and (owner_id = auth.uid() or is_admin())
  );

create policy "owners delete intake sources" on storage.objects
  for delete using (
    bucket_id = 'intake-sources' and (owner_id = auth.uid() or is_admin())
  );

create index intake_sessions_submitter_idx on intake_sessions (submitter_id, created_at desc);
create index source_artifacts_session_idx on source_artifacts (intake_session_id, created_at);
create index field_suggestions_session_idx on field_suggestions (intake_session_id, field_name);

commit;
