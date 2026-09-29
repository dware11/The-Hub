begin;

alter table public.issue_reports
  drop constraint if exists issue_reports_issue_type_check;

alter table public.issue_reports
  add constraint issue_reports_issue_type_check check (issue_type in (
    'Broken link', 'Wrong date/deadline', 'Wrong information', 'Duplicate',
    'Event canceled/changed', 'Organization addition request', 'Sign-in issue',
    'Submission issue', 'Calendar/display issue', 'Page error',
    'Accessibility issue', 'Other'
  ));

commit;
