begin;

-- Organization requests now use the dedicated signed-in flow. Keep validation
-- at the database boundary aligned with the fields presented by that flow.
create or replace function public.validate_issue_report_request_details()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  contact_email text;
  official_website text;
begin
  if new.issue_type = 'Organization addition request' then
    if auth.uid() is null then
      raise exception 'Authentication is required for organization requests';
    end if;
    if new.reporter_email is null or new.reporter_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
      raise exception 'A valid signed-in requestor email is required';
    end if;
    if char_length(trim(coalesce(new.request_details ->> 'organization_name', ''))) not between 2 and 160 then
      raise exception 'Organization name is required';
    end if;
    if char_length(trim(coalesce(new.request_details ->> 'organization_type', ''))) not between 2 and 120 then
      raise exception 'Organization type is required';
    end if;

    contact_email := nullif(trim(coalesce(new.request_details ->> 'organization_contact_email', '')), '');
    if contact_email is not null and contact_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
      raise exception 'Organization contact email is invalid';
    end if;

    official_website := nullif(trim(coalesce(new.request_details ->> 'official_website', '')), '');
    if official_website is not null and official_website !~* '^https?://' then
      raise exception 'Official website must use http or https';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.validate_issue_report_request_details() from public, anon, authenticated;

commit;
