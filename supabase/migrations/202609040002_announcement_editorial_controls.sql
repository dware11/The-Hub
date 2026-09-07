-- Editorial announcement metadata and reviewer feature recommendations.
begin;
alter table public.announcements add column if not exists priority text not null default 'standard' check (priority in ('leadership','code','campus','standard'));
alter table public.announcements add column if not exists is_featured boolean not null default false;
alter table public.announcements add column if not exists featured_until date;
alter table public.announcements add column if not exists expires_at date;
create table if not exists public.feature_recommendations (
  id uuid primary key default gen_random_uuid(), announcement_id uuid not null references public.announcements(id) on delete cascade,
  requested_by uuid not null references public.user_roles(id), status text not null default 'pending' check(status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(), resolved_by uuid references public.user_roles(id), resolved_at timestamptz
);
alter table public.feature_recommendations enable row level security;
revoke all on public.feature_recommendations from public, anon, authenticated;
grant select, insert on public.feature_recommendations to authenticated;
create policy "reviewers read feature recommendations" on public.feature_recommendations for select to authenticated using(public.is_reviewer());
create policy "reviewers recommend announcements" on public.feature_recommendations for insert to authenticated with check(public.is_reviewer() and requested_by in (select id from public.user_roles where auth_user_id=auth.uid() and status='active'));

create or replace function public.recommend_announcement_feature(p_announcement_id uuid)
returns public.feature_recommendations language plpgsql security definer set search_path=public,pg_temp as $$
declare actor public.user_roles; result public.feature_recommendations;
begin
  select * into actor from public.user_roles where auth_user_id=auth.uid() and status='active' and role in ('reviewer','admin','super_admin');
  if actor.id is null then raise exception 'Reviewer access required'; end if;
  if not exists(select 1 from public.announcements where id=p_announcement_id and status='published') then raise exception 'Published announcement not found'; end if;
  insert into public.feature_recommendations(announcement_id,requested_by) values(p_announcement_id,actor.id) returning * into result;
  return result;
end $$;
revoke all on function public.recommend_announcement_feature(uuid) from public,anon;
grant execute on function public.recommend_announcement_feature(uuid) to authenticated;

commit;
