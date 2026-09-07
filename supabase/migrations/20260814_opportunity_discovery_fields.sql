-- Add the fields collected and filtered by the Panther Hub opportunity workflow.
alter table opportunities
  add column if not exists classifications text[] not null default array['All classifications'],
  add column if not exists work_mode text,
  add column if not exists compensation_type text not null default 'Not specified';

update opportunities
set compensation_type = case when paid then 'Paid' else 'Not specified' end
where compensation_type = 'Not specified';

alter table opportunities
  drop constraint if exists opportunities_work_mode_check,
  add constraint opportunities_work_mode_check
    check (work_mode is null or work_mode in ('Remote', 'Hybrid', 'In person')),
  drop constraint if exists opportunities_compensation_type_check,
  add constraint opportunities_compensation_type_check
    check (compensation_type in ('Not specified', 'Paid', 'Funded', 'Unpaid')),
  drop constraint if exists opportunities_location_by_mode_check,
  add constraint opportunities_location_by_mode_check
    check (work_mode is null or work_mode = 'Remote' or nullif(trim(location), '') is not null);

create index if not exists opportunities_type_idx on opportunities(type);
create index if not exists opportunities_work_mode_idx on opportunities(work_mode);
create index if not exists opportunities_compensation_type_idx on opportunities(compensation_type);
create index if not exists opportunities_classifications_gin_idx on opportunities using gin(classifications);
create index if not exists opportunities_majors_gin_idx on opportunities using gin(majors);
