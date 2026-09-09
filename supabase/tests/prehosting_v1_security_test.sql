begin;
select plan(15);

select ok((select attnotnull is false from pg_attribute where attrelid='public.events'::regclass and attname='end_date'), 'event end date is nullable');
select ok((select relrowsecurity from pg_class where oid='public.issue_reports'::regclass), 'issue reports use RLS');

set local role anon;
select lives_ok($$insert into public.issue_reports(issue_type,page_url,description) values('Page error','/events','Anonymous report')$$, 'anonymous report creation succeeds');
select throws_like($$select * from public.issue_reports$$, 'permission denied%', 'anonymous cannot read issues');
select throws_like($$update public.issue_reports set status='resolved'$$, 'permission denied%', 'anonymous cannot update issues');

reset role;
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-4000-8000-000000000701','prehost-contributor@staging.invalid',now()),
 ('00000000-0000-4000-8000-000000000702','prehost-admin@staging.invalid',now());
insert into public.user_roles(id,email,auth_user_id,role,status) values
 ('10000000-0000-4000-8000-000000000701','prehost-contributor@staging.invalid','00000000-0000-4000-8000-000000000701','contributor','active'),
 ('10000000-0000-4000-8000-000000000702','prehost-admin@staging.invalid','00000000-0000-4000-8000-000000000702','admin','active');

set local role authenticated;
set local "request.jwt.claims"='{"sub":"00000000-0000-4000-8000-000000000701","role":"authenticated","email":"prehost-contributor@staging.invalid"}';
select lives_ok($$insert into public.issue_reports(issue_type,page_url,description) values('Submission issue','/panther-submit','Contributor report')$$, 'authenticated report creation succeeds');
select is((select count(*) from public.issue_reports),0::bigint,'contributor cannot read issue reports');
select lives_ok($$do $b$ declare n integer; begin update public.issue_reports set status='resolved',resolved_at=now(); get diagnostics n=row_count; if n<>0 then raise exception 'unexpected issue update'; end if; end $b$;$$,'contributor cannot manage issues');

set local "request.jwt.claims"='{"sub":"00000000-0000-4000-8000-000000000702","role":"authenticated","email":"prehost-admin@staging.invalid"}';
select is((select count(*) from public.issue_reports),2::bigint,'admin reads all issue reports');
select lives_ok($$update public.issue_reports set status='in_review' where status='open'$$,'admin marks issues in review');
select lives_ok($$update public.issue_reports set status='resolved',resolved_at=now() where status='in_review'$$,'admin resolves issues');
select is((select count(*) from public.issue_reports where status='resolved'),2::bigint,'resolved state persists');

reset role;
select throws_like($$insert into public.events(title,type,description,date,end_date,location,contact_name,contact_email,org,submitted_by,status) values('Bad range','Other','Bad','2026-10-17','2026-10-11','PVAMU','Test','test@example.com','Test','10000000-0000-4000-8000-000000000701','pending')$$,'%violates check constraint%','invalid multi-day range is rejected');
select ok(not has_table_privilege('anon','public.issue_reports','SELECT'),'anon lacks issue SELECT grant');
select ok(not has_table_privilege('authenticated','public.issue_reports','DELETE'),'authenticated lacks issue DELETE grant');

select * from finish();
rollback;
