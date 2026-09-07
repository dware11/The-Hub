-- Privacy-preserving daily engagement aggregates.
-- Stores no person, device, request, network, email, or exact-event metadata.

begin;

create table public.engagement_daily (
  bucket_date date not null default (timezone('utc', now()))::date,
  content_type text not null check (content_type in ('opportunity', 'event', 'announcement')),
  content_id text not null check (
    char_length(content_id) between 1 and 160
    and content_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
  ),
  action text not null check (action in (
    'detail_view',
    'application_click',
    'registration_click',
    'source_click',
    'calendar_outlook',
    'calendar_google',
    'list_view'
  )),
  event_count bigint not null default 0 check (event_count >= 0),
  primary key (bucket_date, content_type, content_id, action)
);

comment on table public.engagement_daily is
  'UTC daily aggregate interaction counts. Never stores IP, user agent, referrer, auth user, email, cookie, device identifier, or exact interaction timestamp.';
comment on column public.engagement_daily.event_count is
  'Total interactions, not unique people. Reloads and automated traffic may increase this value.';

create index engagement_daily_type_action_idx
  on public.engagement_daily (content_type, action, bucket_date desc);

alter table public.engagement_daily enable row level security;
revoke all on table public.engagement_daily from public, anon, authenticated;
grant select on table public.engagement_daily to authenticated;

create policy "reviewers read aggregate engagement"
  on public.engagement_daily
  for select
  using (is_reviewer());

create or replace function public.record_engagement(
  p_content_type text,
  p_content_id text,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_id text := trim(p_content_id);
  allowed boolean := false;
begin
  if p_content_type not in ('opportunity', 'event', 'announcement') then
    raise exception 'Invalid engagement content type';
  end if;
  if normalized_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$' then
    raise exception 'Invalid engagement content identifier';
  end if;

  allowed := case p_content_type
    when 'opportunity' then p_action in ('detail_view', 'application_click', 'source_click', 'calendar_outlook', 'calendar_google')
    when 'event' then p_action in ('detail_view', 'registration_click', 'source_click', 'calendar_outlook', 'calendar_google')
    when 'announcement' then p_action = 'list_view'
    else false
  end;
  if not allowed then raise exception 'Invalid engagement action'; end if;

  insert into public.engagement_daily (bucket_date, content_type, content_id, action, event_count)
  values ((timezone('utc', now()))::date, p_content_type, normalized_id, p_action, 1)
  on conflict (bucket_date, content_type, content_id, action)
  do update set event_count = least(public.engagement_daily.event_count + 1, 2147483647);
end;
$$;

revoke all on function public.record_engagement(text, text, text) from public;
grant execute on function public.record_engagement(text, text, text) to anon, authenticated;

create or replace function public.get_engagement_metrics(p_days integer default null)
returns table (content_type text, action text, event_count bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_reviewer() then raise exception 'Reviewer access required'; end if;
  if p_days is not null and p_days not in (7, 30) then raise exception 'Invalid metric window'; end if;

  return query
  select daily.content_type, daily.action, sum(daily.event_count)::bigint
  from public.engagement_daily daily
  where p_days is null or daily.bucket_date >= (timezone('utc', now()))::date - (p_days - 1)
  group by daily.content_type, daily.action
  order by daily.content_type, daily.action;
end;
$$;

revoke all on function public.get_engagement_metrics(integer) from public;
grant execute on function public.get_engagement_metrics(integer) to authenticated;

create or replace function public.get_public_opportunity_connections()
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(event_count), 0)::bigint
  from public.engagement_daily
  where content_type = 'opportunity' and action = 'application_click';
$$;

revoke all on function public.get_public_opportunity_connections() from public;
grant execute on function public.get_public_opportunity_connections() to anon, authenticated;

commit;
