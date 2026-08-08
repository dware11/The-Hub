-- C.O.D.E. Engineering Hub — database schema
-- Run this in the Supabase SQL editor once your project is created.

-- ============ ROLES ============
-- Controls who can post/review. Auth itself (who-is-this-person) is
-- handled by Supabase's Microsoft sign-in -- this table only controls
-- what they're allowed to do once signed in.
create table user_roles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  role text not null check (role in ('admin', 'faculty', 'org_president', 'student')),
  org text, -- which org, if role = 'org_president'
  full_name text,
  status text not null default 'needs_review' check (status in ('active', 'needs_review')),
  created_at timestamptz default now()
);

-- ============ OPPORTUNITIES ============
create table opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  org text not null,
  type text not null, -- Internship, Co-op, Research, Scholarship, Competition, etc.
  paid boolean default false,
  majors text[] default array['All majors'],
  description text not null,
  deadline date not null,
  location text,
  link text not null,
  contact_name text not null,
  contact_email text not null,
  contact_linkedin text,
  flyer_url text, -- original flyer/screenshot, kept visible after publishing (Supabase Storage)
  submitted_by uuid references user_roles(id),
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected', 'archived')),
  verified boolean default false,
  created_at timestamptz default now()
);

-- ============ EVENTS ============
create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null, -- Org meeting, Workshop, Career fair, Competition, College event
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
  org text not null, -- which org/dept owns this event
  flyer_url text, -- original flyer/screenshot, kept visible after publishing (Supabase Storage)
  submitted_by uuid references user_roles(id),
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  verified boolean default false,
  created_at timestamptz default now()
);

-- ============ ANNOUNCEMENTS ============
create table announcements (
  id uuid primary key default gen_random_uuid(),
  source text not null, -- College of Engineering, C.O.D.E., Career Services, etc.
  title text not null,
  body text not null,
  pinned boolean default false,
  emailed_this_week boolean default false,
  submitted_by uuid references user_roles(id),
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  created_at timestamptz default now()
);

-- ============ AUTO-ARCHIVE ============
-- Moves opportunities to 'archived' 15 days after their deadline.
-- Schedule this with pg_cron (see README) to run daily at 12:00am.
create or replace function archive_expired_opportunities()
returns void as $$
begin
  update opportunities
  set status = 'archived'
  where status = 'published'
    and deadline < (current_date - interval '15 days');
end;
$$ language plpgsql security definer;

-- ============ ROLE HELPERS ============
-- Used inside RLS policies below. security definer + a fixed search_path
-- so it can read user_roles regardless of the calling user's own RLS.
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

-- Anyone can read published content
create policy "public read published opportunities" on opportunities
  for select using (status = 'published');
create policy "public read published events" on events
  for select using (status = 'published');
create policy "public read published announcements" on announcements
  for select using (status = 'published');

-- Verified contributors (user_roles.status = 'active') can read their own
-- pending/rejected submissions and can insert new ones. Random authenticated
-- accounts that haven't been reviewed yet cannot post.
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

-- Admins can update status (approve -> published, or reject) on anything
-- pending. This is the only way pending content becomes visible to the
-- public, and it's enforced in the database, not just in the UI.
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

-- user_roles: people can read their own row (to check their own status),
-- admins can read every row (to show names in the review queue).
create policy "read own role" on user_roles
  for select using (email = auth.jwt() ->> 'email');
create policy "admins read all roles" on user_roles
  for select using (is_admin());

-- ============ STORAGE — FLYER UPLOADS ============
-- Bucket for the original flyer/screenshot a submitter uploads. Public
-- read (so "View original flyer" works on published posts), authenticated
-- write (submit form only, verified contributors).
insert into storage.buckets (id, name, public)
values ('flyers', 'flyers', true)
on conflict (id) do nothing;

create policy "public read flyers" on storage.objects
  for select using (bucket_id = 'flyers');
create policy "verified contributors upload flyers" on storage.objects
  for insert with check (bucket_id = 'flyers' and is_verified_contributor());
