begin;
select plan(15);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-000000000101', 'phase4-no-role@staging.invalid', now()),
  ('00000000-0000-4000-8000-000000000102', 'phase4-contributor@staging.invalid', now()),
  ('00000000-0000-4000-8000-000000000103', 'phase4-reviewer@staging.invalid', now()),
  ('00000000-0000-4000-8000-000000000104', 'phase4-admin@staging.invalid', now()),
  ('00000000-0000-4000-8000-000000000105', 'phase4-super-admin@staging.invalid', now());

insert into public.user_roles (id, email, auth_user_id, role, status) values
  ('10000000-0000-4000-8000-000000000102', 'phase4-contributor@staging.invalid', '00000000-0000-4000-8000-000000000102', 'contributor', 'active'),
  ('10000000-0000-4000-8000-000000000103', 'phase4-reviewer@staging.invalid', '00000000-0000-4000-8000-000000000103', 'reviewer', 'active'),
  ('10000000-0000-4000-8000-000000000104', 'phase4-admin@staging.invalid', '00000000-0000-4000-8000-000000000104', 'admin', 'active'),
  ('10000000-0000-4000-8000-000000000105', 'phase4-super-admin@staging.invalid', '00000000-0000-4000-8000-000000000105', 'super_admin', 'active');

insert into public.announcements (id, source, title, body, submitted_by, status) values
  ('20000000-0000-4000-8000-000000000103', 'Phase 4A', 'Reviewer-owned', 'Ephemeral test record.', '10000000-0000-4000-8000-000000000103', 'pending'),
  ('20000000-0000-4000-8000-000000000104', 'Phase 4A', 'Admin-owned', 'Ephemeral test record.', '10000000-0000-4000-8000-000000000104', 'pending'),
  ('20000000-0000-4000-8000-000000000105', 'Phase 4A', 'Super-admin-owned', 'Ephemeral test record.', '10000000-0000-4000-8000-000000000105', 'pending'),
  ('20000000-0000-4000-8000-000000000201', 'Phase 4A', 'Contributor submission A', 'Ephemeral test record.', '10000000-0000-4000-8000-000000000102', 'pending'),
  ('20000000-0000-4000-8000-000000000202', 'Phase 4A', 'Contributor submission B', 'Ephemeral test record.', '10000000-0000-4000-8000-000000000102', 'pending'),
  ('20000000-0000-4000-8000-000000000203', 'Phase 4A', 'Contributor submission C', 'Ephemeral test record.', '10000000-0000-4000-8000-000000000102', 'pending');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated","email":"phase4-reviewer@staging.invalid"}';

select throws_ok(
  $$select public.record_review_evidence('announcement','20000000-0000-4000-8000-000000000103',true,true,true,true,true,'self evidence','approved')$$,
  'P0001',
  'Reviewers cannot review or modify review evidence for their own submission',
  'reviewer cannot record evidence for own submission'
);
select throws_ok(
  $$select public.request_review_correction('announcement','20000000-0000-4000-8000-000000000103','self correction')$$,
  'P0001',
  'Reviewers cannot review or modify review evidence for their own submission',
  'reviewer cannot request correction on own submission'
);
select throws_ok(
  $$select public.review_content('announcement','20000000-0000-4000-8000-000000000103','rejected','self rejection')$$,
  'P0001',
  'Reviewers cannot review or modify review evidence for their own submission',
  'reviewer cannot reject own submission'
);
select throws_ok(
  $$select public.review_content('announcement','20000000-0000-4000-8000-000000000103','published',null)$$,
  'P0001',
  'Reviewers cannot review or modify review evidence for their own submission',
  'reviewer cannot publish own submission'
);

select lives_ok(
  $$select public.record_review_evidence('announcement','20000000-0000-4000-8000-000000000201',true,true,true,true,true,'independent evidence','approved')$$,
  'reviewer can record evidence for another contributor'
);
select lives_ok(
  $$select public.request_review_correction('announcement','20000000-0000-4000-8000-000000000201','independent correction')$$,
  'reviewer can request correction for another contributor'
);
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated","email":"phase4-contributor@staging.invalid"}';
select lives_ok(
  $$select public.resubmit_corrected_content('announcement','20000000-0000-4000-8000-000000000201')$$,
  'original contributor can resubmit corrected content'
);
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated","email":"phase4-reviewer@staging.invalid"}';
select lives_ok(
  $$select public.record_review_evidence('announcement','20000000-0000-4000-8000-000000000201',true,true,true,true,true,'verified after correction','approved')$$,
  'reviewer can complete evidence after correction'
);
select lives_ok(
  $$select public.review_content('announcement','20000000-0000-4000-8000-000000000201','published',null)$$,
  'reviewer can publish another contributor submission after verification'
);

set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated","email":"phase4-contributor@staging.invalid"}';
select throws_ok(
  $$select public.record_review_evidence('announcement','20000000-0000-4000-8000-000000000202',true,true,true,true,true,'not allowed','approved')$$,
  'P0001',
  'Reviewer access required',
  'contributor remains unable to record review evidence'
);

set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated","email":"phase4-no-role@staging.invalid"}';
select throws_ok(
  $$select public.request_review_correction('announcement','20000000-0000-4000-8000-000000000202','not allowed')$$,
  'P0001',
  'Reviewer access required',
  'no-role user remains unable to request review correction'
);

set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000104","role":"authenticated","email":"phase4-admin@staging.invalid"}';
select throws_ok(
  $$select public.record_review_evidence('announcement','20000000-0000-4000-8000-000000000104',true,true,true,true,true,'self evidence','approved')$$,
  'P0001',
  'Reviewers cannot review or modify review evidence for their own submission',
  'admin cannot record evidence for own submission'
);
select lives_ok(
  $$select public.request_review_correction('announcement','20000000-0000-4000-8000-000000000202','admin correction')$$,
  'admin retains correction permission for another contributor'
);

set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000105","role":"authenticated","email":"phase4-super-admin@staging.invalid"}';
select throws_ok(
  $$select public.review_content('announcement','20000000-0000-4000-8000-000000000105','published',null)$$,
  'P0001',
  'Reviewers cannot review or modify review evidence for their own submission',
  'super-admin cannot publish own submission'
);
select lives_ok(
  $$select public.record_review_evidence('announcement','20000000-0000-4000-8000-000000000203',true,true,true,true,true,'super-admin evidence','approved')$$,
  'super-admin retains evidence permission for another contributor'
);

reset role;
select * from finish();
rollback;
