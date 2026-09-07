-- C.O.D.E. Engineering Hub baseline schema.
-- This migration intentionally precedes every incremental Panther Hub migration
-- so a blank Supabase project can be bootstrapped with `supabase db push` alone.

begin;

set local search_path = public, extensions, pg_temp;

-- ============ ROLES ============
-- Authentication is provided by Supabase Auth. This table controls application
-- authorization and is aligned to launch RBAC by the 20260823 migration.
create table user_roles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  role text not null check (role in ('admin', 'faculty', 'org_president', 'student')),
  org text,
  full_name text,
  status text not null default 'needs_review' check (status in ('active', 'needs_review')),
  created_at timestamptz default now()
);

-- ============ OPPORTUNITIES ============
create table opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  org text not null,
  type text not null,
  paid boolean default false,
  majors text[] default array['All majors'],
  classifications text[] default array['All classifications'],
  work_mode text check (work_mode is null or work_mode in ('Remote', 'Hybrid', 'In person')),
  compensation_type text not null default 'Not specified' check (compensation_type in ('Not specified', 'Paid', 'Funded', 'Unpaid')),
  description text not null,
  eligibility text,
  deadline date not null,
  location text,
  link text not null,
  contact_name text not null,
  contact_email text not null,
  contact_linkedin text,
  flyer_url text,
  submitted_by uuid references user_roles(id),
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected', 'archived')),
  verified boolean default false,
  created_at timestamptz default now()
);

-- ============ EVENTS ============
create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null,
  majors text[] default array['All majors'],
  description text not null,
  date date not null,
  time text,
  location text not null,
  registration_link text,
  presenter_name text,
  presenter_affiliation text,
  is_alumni_presenter boolean default false,
  is_sponsor_presenter boolean default false,
  contact_name text not null,
  contact_email text not null,
  org text not null,
  flyer_url text,
  submitted_by uuid references user_roles(id),
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  verified boolean default false,
  created_at timestamptz default now()
);

-- ============ ANNOUNCEMENTS ============
create table announcements (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  title text not null,
  body text not null,
  pinned boolean default false,
  emailed_this_week boolean default false,
  submitted_by uuid references user_roles(id),
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  created_at timestamptz default now()
);

-- ============ AUTO-ARCHIVE ============
create or replace function archive_expired_opportunities()
returns void as $$
begin
  update opportunities
  set status = 'archived'
  where status = 'published'
    and deadline < (current_date - interval '15 days');
end;
$$ language plpgsql security definer;

-- ============ LEGACY ROLE HELPERS ============
-- These email-based helpers are required by the historical migrations below.
-- The launch RBAC migration replaces them with auth.uid()-bound role checks.
create or replace function is_verified_contributor()
returns boolean as $$
  select exists (
    select 1 from user_roles
    where email = auth.jwt() ->> 'email'
      and status = 'active'
  );
$$ language sql security definer set search_path = public;

create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from user_roles
    where email = auth.jwt() ->> 'email'
      and role = 'admin'
      and status = 'active'
  );
$$ language sql security definer set search_path = public;

-- ============ ROW LEVEL SECURITY ============
alter table opportunities enable row level security;
alter table events enable row level security;
alter table announcements enable row level security;
alter table user_roles enable row level security;

create policy "public read published opportunities" on opportunities
  for select using (status = 'published');
create policy "public read published events" on events
  for select using (status = 'published');
create policy "public read published announcements" on announcements
  for select using (status = 'published');

create policy "contributors read own opportunities" on opportunities
  for select using (is_verified_contributor() and submitted_by in (
    select id from user_roles where email = auth.jwt() ->> 'email'
  ));
create policy "verified contributors can submit opportunities" on opportunities
  for insert with check (is_verified_contributor());
create policy "verified contributors can submit events" on events
  for insert with check (is_verified_contributor());
create policy "verified contributors can submit announcements" on announcements
  for insert with check (is_verified_contributor());

create policy "admins can update opportunities" on opportunities
  for update using (is_admin()) with check (is_admin());
create policy "admins can update events" on events
  for update using (is_admin()) with check (is_admin());
create policy "admins can update announcements" on announcements
  for update using (is_admin()) with check (is_admin());
create policy "admins read all opportunities" on opportunities
  for select using (is_admin());
create policy "admins read all events" on events
  for select using (is_admin());
create policy "admins read all announcements" on announcements
  for select using (is_admin());

create policy "read own role" on user_roles
  for select using (email = auth.jwt() ->> 'email');
create policy "admins read all roles" on user_roles
  for select using (is_admin());

-- ============ STORAGE — FLYER UPLOADS ============
insert into storage.buckets (id, name, public)
values ('flyers', 'flyers', true)
on conflict (id) do nothing;

create policy "public read flyers" on storage.objects
  for select using (bucket_id = 'flyers');
create policy "verified contributors upload flyers" on storage.objects
  for insert with check (bucket_id = 'flyers' and is_verified_contributor());

commit;
