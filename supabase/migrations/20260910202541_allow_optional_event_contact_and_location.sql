begin;

alter table public.events
  alter column location drop not null,
  alter column contact_name drop not null,
  alter column contact_email drop not null;

commit;
