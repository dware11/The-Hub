begin;
select plan(37);

-- The ACL checks are deliberately aggregate: one failure names the role and
-- privilege while still covering every application table.
create temporary table acl_expected (
  table_name text primary key,
  anon_select boolean not null default false,
  auth_select boolean not null default false,
  auth_insert boolean not null default false,
  auth_update boolean not null default false,
  auth_delete boolean not null default false
);

insert into acl_expected(table_name,anon_select,auth_select,auth_insert,auth_update,auth_delete) values
  ('user_roles',false,true,false,false,false),
  ('opportunities',true,true,true,false,false),
  ('events',true,true,true,false,false),
  ('announcements',true,true,true,false,false),
  ('audit_events',false,true,false,false,false),
  ('digest_runs',false,false,false,false,false),
  ('intake_sessions',false,true,true,true,false),
  ('source_artifacts',false,true,true,true,true),
  ('field_suggestions',false,true,true,false,false),
  ('engagement_daily',false,true,false,false,false),
  ('intake_parser_feedback',false,true,false,false,false),
  ('contributor_access_requests',false,true,false,false,false),
  ('feature_recommendations',false,true,true,false,false),
  ('review_verification_evidence',false,true,false,false,false);

select ok((select bool_and(c.relrowsecurity) from acl_expected e join pg_class c on c.oid=('public.'||quote_ident(e.table_name))::regclass), 'RLS remains enabled on all 14 application tables');
select is((select count(*) from information_schema.sequences where sequence_schema='public'),0::bigint,'no public sequences require Data API grants');

select ok((select bool_and(has_table_privilege('anon','public.'||quote_ident(table_name),'SELECT')=anon_select) from acl_expected),'anon SELECT grants exactly match the matrix');
select ok((select bool_and(
  not has_table_privilege('anon','public.'||quote_ident(table_name),'INSERT')
  and not has_table_privilege('anon','public.'||quote_ident(table_name),'UPDATE')
  and not has_table_privilege('anon','public.'||quote_ident(table_name),'DELETE')
) from acl_expected),'anon has no application-table writes');
select ok((select bool_and(has_table_privilege('authenticated','public.'||quote_ident(table_name),'SELECT')=auth_select) from acl_expected),'authenticated SELECT grants exactly match the matrix');
select ok((select bool_and(has_table_privilege('authenticated','public.'||quote_ident(table_name),'INSERT')=auth_insert) from acl_expected),'authenticated INSERT grants exactly match the matrix');
select ok((select bool_and(has_table_privilege('authenticated','public.'||quote_ident(table_name),'UPDATE')=auth_update) from acl_expected),'authenticated UPDATE grants exactly match the matrix');
select ok((select bool_and(has_table_privilege('authenticated','public.'||quote_ident(table_name),'DELETE')=auth_delete) from acl_expected),'authenticated DELETE grants exactly match the matrix');

select ok((select bool_and(not has_table_privilege('anon','public.'||quote_ident(table_name),'TRUNCATE')) from acl_expected),'anon has no TRUNCATE');
select ok((select bool_and(not has_table_privilege('anon','public.'||quote_ident(table_name),'REFERENCES')) from acl_expected),'anon has no REFERENCES');
select ok((select bool_and(not has_table_privilege('anon','public.'||quote_ident(table_name),'TRIGGER')) from acl_expected),'anon has no TRIGGER');
select ok((select bool_and(not has_table_privilege('anon','public.'||quote_ident(table_name),'MAINTAIN')) from acl_expected),'anon has no MAINTAIN');
select ok((select bool_and(not has_table_privilege('authenticated','public.'||quote_ident(table_name),'TRUNCATE')) from acl_expected),'authenticated has no TRUNCATE');
select ok((select bool_and(not has_table_privilege('authenticated','public.'||quote_ident(table_name),'REFERENCES')) from acl_expected),'authenticated has no REFERENCES');
select ok((select bool_and(not has_table_privilege('authenticated','public.'||quote_ident(table_name),'TRIGGER')) from acl_expected),'authenticated has no TRIGGER');
select ok((select bool_and(not has_table_privilege('authenticated','public.'||quote_ident(table_name),'MAINTAIN')) from acl_expected),'authenticated has no MAINTAIN');

insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-4000-8000-000000000301','acl-no-role@staging.invalid',now()),
 ('00000000-0000-4000-8000-000000000302','acl-contributor@staging.invalid',now()),
 ('00000000-0000-4000-8000-000000000303','acl-other@staging.invalid',now()),
 ('00000000-0000-4000-8000-000000000304','acl-reviewer@staging.invalid',now()),
 ('00000000-0000-4000-8000-000000000305','acl-admin@staging.invalid',now());
insert into public.user_roles(id,email,auth_user_id,role,status) values
 ('10000000-0000-4000-8000-000000000302','acl-contributor@staging.invalid','00000000-0000-4000-8000-000000000302','contributor','active'),
 ('10000000-0000-4000-8000-000000000303','acl-other@staging.invalid','00000000-0000-4000-8000-000000000303','contributor','active'),
 ('10000000-0000-4000-8000-000000000304','acl-reviewer@staging.invalid','00000000-0000-4000-8000-000000000304','reviewer','active'),
 ('10000000-0000-4000-8000-000000000305','acl-admin@staging.invalid','00000000-0000-4000-8000-000000000305','admin','active');
insert into public.announcements(id,source,title,body,submitted_by,status) values
 ('20000000-0000-4000-8000-000000000301','ACL test','Published fixture','Ephemeral','10000000-0000-4000-8000-000000000302','published'),
 ('20000000-0000-4000-8000-000000000302','ACL test','Contributor private','Ephemeral','10000000-0000-4000-8000-000000000302','pending'),
 ('20000000-0000-4000-8000-000000000303','ACL test','Other private','Ephemeral','10000000-0000-4000-8000-000000000303','pending');
insert into public.intake_sessions(id,submitter_id,content_type,relationship_to_source,state) values
 ('30000000-0000-4000-8000-000000000302','10000000-0000-4000-8000-000000000302','announcement','original_contact','draft'),
 ('30000000-0000-4000-8000-000000000303','10000000-0000-4000-8000-000000000303','announcement','original_contact','draft');
insert into storage.objects(bucket_id,name,owner_id) values
 ('flyers','acl-public-fixture.pdf','00000000-0000-4000-8000-000000000302'),
 ('intake-sources','10000000-0000-4000-8000-000000000303/30000000-0000-4000-8000-000000000303/private.pdf','00000000-0000-4000-8000-000000000303');

set local role anon;
select is((select count(*) from public.announcements),1::bigint,'anon reads only published content');
select throws_like($$select * from public.user_roles$$,'permission denied%','anon cannot read roles');
select throws_like($$insert into public.announcements(source,title,body,status) values('x','x','x','pending')$$,'permission denied%','anon cannot submit content');
select is((select count(*) from storage.objects where bucket_id='flyers'),1::bigint,'anon reads public flyers');
select is((select count(*) from storage.objects where bucket_id='intake-sources'),0::bigint,'anon cannot read private intake sources');
select throws_like($$insert into storage.objects(bucket_id,name,owner_id) values('flyers','unauthorized.pdf','00000000-0000-4000-8000-000000000301')$$,'new row violates row-level security policy%','anon cannot mutate flyers');

set local role authenticated;
set local "request.jwt.claims"='{"sub":"00000000-0000-4000-8000-000000000301","role":"authenticated","email":"acl-no-role@staging.invalid"}';
select is((select count(*) from public.announcements),1::bigint,'no-role user retains public reads');
select is((select count(*) from public.user_roles),0::bigint,'no-role user sees no role rows');
select is((select count(*) from public.audit_events),0::bigint,'ordinary user cannot read audit history');

set local "request.jwt.claims"='{"sub":"00000000-0000-4000-8000-000000000302","role":"authenticated","email":"acl-contributor@staging.invalid"}';
select is((select count(*) from public.user_roles),1::bigint,'contributor sees only own bound role');
select lives_ok($$insert into public.announcements(id,source,title,body,submitted_by,status) values('20000000-0000-4000-8000-000000000304','ACL test','Contributor insert','Ephemeral','10000000-0000-4000-8000-000000000302','pending')$$,'contributor submission succeeds');
select is((select count(*) from public.announcements where id='20000000-0000-4000-8000-000000000303'),0::bigint,'contributor cannot read another contributor private submission');
select lives_ok($$do $block$ declare affected integer; begin update public.announcements set title='blocked' where id='20000000-0000-4000-8000-000000000303'; get diagnostics affected=row_count; if affected<>0 then raise exception 'cross-user update'; end if; end $block$;$$,'contributor cannot modify another submission');
select lives_ok($$insert into storage.objects(bucket_id,name,owner_id) values('intake-sources','10000000-0000-4000-8000-000000000302/30000000-0000-4000-8000-000000000302/owner.pdf','00000000-0000-4000-8000-000000000302')$$,'intake source owner upload succeeds');
select is((select count(*) from storage.objects where bucket_id='intake-sources'),1::bigint,'owner reads only own private intake source');
select lives_ok($$do $block$ declare affected integer; begin update storage.objects set name=name||'.overwrite' where bucket_id='intake-sources'; get diagnostics affected=row_count; if affected<>0 then raise exception 'unexpected storage update'; end if; end $block$;$$,'owner cannot overwrite without an update policy');
select throws_like($$delete from storage.objects where name like '%000000000303/private.pdf'$$,'Direct deletion from storage tables is not allowed%','direct client deletion cannot bypass the Storage API');

set local "request.jwt.claims"='{"sub":"00000000-0000-4000-8000-000000000304","role":"authenticated","email":"acl-reviewer@staging.invalid"}';
select is((select count(*) from public.announcements where status='pending'),3::bigint,'reviewer queue reads all pending content');
select is((select count(*) from storage.objects where bucket_id='intake-sources'),2::bigint,'reviewer reads private intake sources for review');

-- Immediate revocation must affect the next statement in the same JWT session.
reset role;
update public.user_roles set status='needs_review' where auth_user_id='00000000-0000-4000-8000-000000000304';
set local role authenticated;
select throws_ok($$select public.request_review_correction('announcement','20000000-0000-4000-8000-000000000303','revoked reviewer')$$,'P0001','Reviewer access required','revoked reviewer loses privilege immediately');

set local "request.jwt.claims"='{"sub":"00000000-0000-4000-8000-000000000305","role":"authenticated","email":"acl-admin@staging.invalid"}';
select is((select count(*) from public.user_roles),4::bigint,'admin can read the role roster');

reset role;
select * from finish();
rollback;
