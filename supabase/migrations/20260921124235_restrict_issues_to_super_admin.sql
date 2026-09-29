begin;

drop policy if exists "admins read issue reports" on public.issue_reports;
drop policy if exists "admins update issue reports" on public.issue_reports;

create policy "super admins read issue reports"
  on public.issue_reports for select
  to authenticated
  using (public.is_super_admin());

create policy "super admins update issue reports"
  on public.issue_reports for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

commit;
