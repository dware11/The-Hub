-- Private availability-maintenance metadata for published Apply ASAP opportunities.
-- Keeping this in a separate RLS-protected table prevents the maintenance fields
-- from being exposed through the public opportunities Data API response.

create table if not exists public.opportunity_availability_reviews (
  opportunity_id uuid primary key references public.opportunities(id) on delete cascade,
  last_verified_at timestamptz not null default now(),
  next_review_at date not null default (current_date + 30),
  verified_by uuid not null references public.user_roles(id),
  updated_at timestamptz not null default now()
);

alter table public.opportunity_availability_reviews enable row level security;

drop policy if exists "super admins manage opportunity availability" on public.opportunity_availability_reviews;
create policy "super admins manage opportunity availability"
  on public.opportunity_availability_reviews
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

revoke all on table public.opportunity_availability_reviews from public, anon;
grant select, insert, update, delete on table public.opportunity_availability_reviews to authenticated;

comment on table public.opportunity_availability_reviews is
  'Private super-admin availability review schedule for published Apply ASAP opportunities.';
