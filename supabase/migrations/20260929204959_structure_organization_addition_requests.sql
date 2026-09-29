begin;

alter table public.issue_reports
  add column if not exists request_details jsonb;

alter table public.issue_reports
  drop constraint if exists issue_reports_request_details_object_check;

alter table public.issue_reports
  add constraint issue_reports_request_details_object_check
  check (request_details is null or jsonb_typeof(request_details) = 'object');

-- Validate all new or materially edited organization requests without blocking
-- status-only updates to the historical request that predates these fields.
create or replace function public.validate_issue_report_request_details()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.issue_type = 'Organization addition request' then
    if new.reporter_email is null or new.reporter_email !~* '^[A-Z0-9._%+-]+@pvamu[.]edu$' then
      raise exception 'A valid @pvamu.edu email is required for organization requests';
    end if;
    if char_length(trim(coalesce(new.request_details ->> 'organization_name', ''))) not between 2 and 160 then
      raise exception 'Organization name is required';
    end if;
    if char_length(trim(coalesce(new.request_details ->> 'organization_abbreviation', ''))) not between 1 and 24 then
      raise exception 'Organization abbreviation is required';
    end if;
    if char_length(trim(coalesce(new.request_details ->> 'organization_relationship', ''))) not between 2 and 160 then
      raise exception 'Organization relationship is required';
    end if;
    if coalesce(new.request_details ->> 'organization_email', '') !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
      raise exception 'A valid organization email is required';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.validate_issue_report_request_details() from public, anon, authenticated;

drop trigger if exists issue_reports_validate_request_details on public.issue_reports;
create trigger issue_reports_validate_request_details
before insert or update of issue_type, reporter_email, request_details on public.issue_reports
for each row execute function public.validate_issue_report_request_details();

comment on column public.issue_reports.request_details is
  'Structured, non-public request fields used for organization-addition verification.';

commit;
