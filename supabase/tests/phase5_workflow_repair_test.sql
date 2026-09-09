begin;
select plan(21);

insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-4000-8000-000000000501','p5-contributor@staging.invalid',now()),
 ('00000000-0000-4000-8000-000000000502','p5-other@staging.invalid',now()),
 ('00000000-0000-4000-8000-000000000503','p5-reviewer@staging.invalid',now()),
 ('00000000-0000-4000-8000-000000000504','p5-admin@staging.invalid',now());
insert into public.user_roles(id,email,auth_user_id,role,status) values
 ('10000000-0000-4000-8000-000000000501','p5-contributor@staging.invalid','00000000-0000-4000-8000-000000000501','contributor','active'),
 ('10000000-0000-4000-8000-000000000502','p5-other@staging.invalid','00000000-0000-4000-8000-000000000502','contributor','active'),
 ('10000000-0000-4000-8000-000000000503','p5-reviewer@staging.invalid','00000000-0000-4000-8000-000000000503','reviewer','active'),
 ('10000000-0000-4000-8000-000000000504','p5-admin@staging.invalid','00000000-0000-4000-8000-000000000504','admin','active');

insert into public.opportunities(id,title,org,type,description,deadline,link,contact_name,contact_email,submitted_by,status) values
 ('20000000-0000-4000-8000-000000000501','Correction target','P5','Internship','Before correction','2026-12-01','https://example.com/correct','Owner','owner@example.com','10000000-0000-4000-8000-000000000501','pending'),
 ('20000000-0000-4000-8000-000000000502','Other returned','P5','Internship','Other owner','2026-12-01','https://example.com/other','Other','other@example.com','10000000-0000-4000-8000-000000000502','needs_correction'),
 ('20000000-0000-4000-8000-000000000503','Still pending','P5','Internship','Pending','2026-12-01','https://example.com/pending','Owner','owner@example.com','10000000-0000-4000-8000-000000000501','pending'),
 ('20000000-0000-4000-8000-000000000504','Already published','P5','Internship','Published','2026-12-01','https://example.com/published','Owner','owner@example.com','10000000-0000-4000-8000-000000000501','published');

set local role authenticated;
set local "request.jwt.claims"='{"sub":"00000000-0000-4000-8000-000000000503","role":"authenticated","email":"p5-reviewer@staging.invalid"}';
select lives_ok($$select public.request_review_correction('opportunity','20000000-0000-4000-8000-000000000501','Clarify eligibility')$$,'reviewer correction request succeeds');
select is((select status from public.opportunities where id='20000000-0000-4000-8000-000000000501'),'needs_correction','correction state persists on content');
select is((select reviewer_notes from public.review_verification_evidence where content_id='20000000-0000-4000-8000-000000000501'),'Clarify eligibility','correction reason is retained');

set local "request.jwt.claims"='{"sub":"00000000-0000-4000-8000-000000000501","role":"authenticated","email":"p5-contributor@staging.invalid"}';
select lives_ok($$update public.opportunities set description='Corrected details' where id='20000000-0000-4000-8000-000000000501'$$,'owner edits returned content');
select is((select description from public.opportunities where id='20000000-0000-4000-8000-000000000501'),'Corrected details','owner edit persists');
select lives_ok($$do $b$ declare n integer; begin update public.opportunities set description='blocked' where id='20000000-0000-4000-8000-000000000502'; get diagnostics n=row_count; if n<>0 then raise exception 'cross-user update'; end if; end $b$;$$,'other contributor content cannot be edited');
select lives_ok($$do $b$ declare n integer; begin update public.opportunities set description='blocked' where id='20000000-0000-4000-8000-000000000503'; get diagnostics n=row_count; if n<>0 then raise exception 'pending update'; end if; end $b$;$$,'pending content cannot be edited');
select lives_ok($$do $b$ declare n integer; begin update public.opportunities set description='blocked' where id='20000000-0000-4000-8000-000000000504'; get diagnostics n=row_count; if n<>0 then raise exception 'published update'; end if; end $b$;$$,'published content cannot be edited');

reset role;
update public.user_roles set status='needs_review' where id='10000000-0000-4000-8000-000000000501';
set local role authenticated;
select lives_ok($$do $b$ declare n integer; begin update public.opportunities set description='blocked' where id='20000000-0000-4000-8000-000000000501'; get diagnostics n=row_count; if n<>0 then raise exception 'revoked update'; end if; end $b$;$$,'revoked contributor cannot edit returned content');
reset role;
update public.user_roles set status='active' where id='10000000-0000-4000-8000-000000000501';
set local role authenticated;
select lives_ok($$select public.resubmit_corrected_content('opportunity','20000000-0000-4000-8000-000000000501')$$,'owner resubmits same content identity');
select is((select status from public.opportunities where id='20000000-0000-4000-8000-000000000501'),'resubmitted','resubmitted state persists');
select ok((select resubmitted_at is not null from public.opportunities where id='20000000-0000-4000-8000-000000000501'),'resubmission timestamp is recorded');

insert into public.opportunities(id,title,org,type,description,deadline,link,contact_name,contact_email,submitted_by,status) values
 ('20000000-0000-4000-8000-000000000511','Same title','P5','Internship','First','2026-12-01','https://example.com/apply/','Owner','owner@example.com','10000000-0000-4000-8000-000000000501','pending'),
 ('20000000-0000-4000-8000-000000000512',' same   title ','P5','Internship','Second','2026-12-01','https://example.com/apply#details','Owner','owner@example.com','10000000-0000-4000-8000-000000000501','pending'),
 ('20000000-0000-4000-8000-000000000513','Same title','P5','Internship','Different link','2026-12-01','https://example.com/different','Owner','owner@example.com','10000000-0000-4000-8000-000000000501','pending'),
 ('20000000-0000-4000-8000-000000000514','Different title','P5','Internship','Shared domain','2026-12-01','https://example.com/apply','Owner','owner@example.com','10000000-0000-4000-8000-000000000501','pending');
select ok((select possible_duplicate from public.opportunities where id='20000000-0000-4000-8000-000000000512'),'same normalized title and link is flagged');
select ok(not (select possible_duplicate from public.opportunities where id='20000000-0000-4000-8000-000000000513'),'same title with different link is not flagged');
select ok(not (select possible_duplicate from public.opportunities where id='20000000-0000-4000-8000-000000000514'),'different title on shared domain is not flagged');

reset role;
insert into public.events(id,title,type,description,date,time,location,registration_link,contact_name,contact_email,org,submitted_by,status,recurrence_type,recurrence_weekday,recurrence_start_date,recurrence_end_date,recurrence_start_time,recurrence_end_time) values
 ('20000000-0000-4000-8000-000000000520','Graduating Senior Job Search Workshops','Career','Weekly workshop','2026-10-02','10:00 AM–12:00 PM','Engineering','https://example.com/workshop','Host','host@example.com','Career Center','10000000-0000-4000-8000-000000000501','published','weekly',5,'2026-10-02','2026-11-20','10:00','12:00');
select is((select count(*) from public.events where id='20000000-0000-4000-8000-000000000520'),1::bigint,'weekly series remains one logical event');
select is((select recurrence_end_date from public.events where id='20000000-0000-4000-8000-000000000520'),'2026-11-20'::date,'weekly recurrence boundary is structured');

set local role authenticated;
set local "request.jwt.claims"='{"sub":"00000000-0000-4000-8000-000000000504","role":"authenticated","email":"p5-admin@staging.invalid"}';
select lives_ok($$select public.manage_published_content('opportunity','20000000-0000-4000-8000-000000000504','edit','{"source_url":"https://example.com/admin-opportunity"}'::jsonb)$$,'admin opportunity edit uses canonical link column');
select is((select link from public.opportunities where id='20000000-0000-4000-8000-000000000504'),'https://example.com/admin-opportunity','admin opportunity link edit persists');
select lives_ok($$select public.manage_published_content('event','20000000-0000-4000-8000-000000000520','edit','{"source_url":"https://example.com/admin-event"}'::jsonb)$$,'admin event edit uses registration_link');
select is((select registration_link from public.events where id='20000000-0000-4000-8000-000000000520'),'https://example.com/admin-event','admin event link edit persists');

reset role;
select * from finish();
rollback;
