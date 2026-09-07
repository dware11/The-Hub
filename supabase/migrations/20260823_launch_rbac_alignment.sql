-- Launch RBAC alignment: contributor -> reviewer -> admin.
-- Apply only after backup and after reviewing the preflight assertions below.
begin;

do $$
begin
  if exists (
    select lower(trim(email)) from user_roles
    group by lower(trim(email)) having count(*) > 1
  ) then
    raise exception 'Duplicate normalized user_roles emails must be resolved before RBAC migration.';
  end if;
  if exists (select 1 from user_roles where role not in ('admin','faculty','org_president','student','contributor','reviewer')) then
    raise exception 'Unexpected legacy user_roles.role value; review before RBAC migration.';
  end if;
end $$;

alter table user_roles add column if not exists auth_user_id uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='user_roles_auth_user_id_fkey' and conrelid='public.user_roles'::regclass) then
    alter table user_roles add constraint user_roles_auth_user_id_fkey foreign key(auth_user_id) references auth.users(id) on delete set null;
  end if;
end $$;
update user_roles set email = lower(trim(email));
-- Explicit legacy mapping: admin remains admin; other known legacy roles become contributor.
update user_roles set role = case when role = 'admin' then 'admin' else 'contributor' end
where role in ('admin','faculty','org_president','student');
alter table user_roles drop constraint if exists user_roles_role_check;
alter table user_roles add constraint user_roles_role_check check (role in ('contributor','reviewer','admin'));
create unique index if not exists user_roles_auth_user_id_uidx on user_roles(auth_user_id) where auth_user_id is not null;

create or replace function has_active_role(allowed_roles text[])
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from user_roles
    where auth_user_id = auth.uid() and status = 'active' and role = any(allowed_roles)
  );
$$;
create or replace function is_verified_contributor()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select has_active_role(array['contributor','reviewer','admin']);
$$;
create or replace function is_reviewer()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select has_active_role(array['reviewer','admin']);
$$;
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select has_active_role(array['admin']);
$$;

revoke all on function has_active_role(text[]) from public;
revoke all on function is_verified_contributor() from public;
revoke all on function is_reviewer() from public;
revoke all on function is_admin() from public;
grant execute on function has_active_role(text[]) to authenticated;
grant execute on function is_verified_contributor() to authenticated;
grant execute on function is_reviewer() to authenticated;
grant execute on function is_admin() to authenticated;

create or replace function claim_my_role()
returns user_roles language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare
  caller_id uuid := auth.uid();
  caller_email text;
  claimed user_roles;
begin
  if caller_id is null then raise exception 'Authentication required'; end if;
  select lower(trim(email)) into caller_email from auth.users
  where id = caller_id and email_confirmed_at is not null;
  if caller_email is null then raise exception 'A verified Microsoft email is required'; end if;

  select * into claimed from user_roles where auth_user_id = caller_id;
  if found then return claimed; end if;

  update user_roles set auth_user_id = caller_id
  where id = (
    select id from user_roles
    where lower(trim(email)) = caller_email and status = 'active' and auth_user_id is null
    for update skip locked limit 1
  ) returning * into claimed;
  if not found then return null; end if;

  insert into audit_events(content_type, actor_type, actor_id, action, changes)
  values ('system', case when claimed.role='admin' then 'administrator' when claimed.role='reviewer' then 'reviewer' else 'contributor' end,
          claimed.id, 'role_claimed', jsonb_build_object('auth_user_id', caller_id));
  return claimed;
end $$;
revoke all on function claim_my_role() from public;
grant execute on function claim_my_role() to authenticated;

drop policy if exists "read own role" on user_roles;
drop policy if exists "admins read all roles" on user_roles;
create policy "users read bound role" on user_roles for select using (auth_user_id = auth.uid());
create policy "admins read all roles" on user_roles for select using (is_admin());

drop policy if exists "contributors read own opportunities" on opportunities;
drop policy if exists "contributors read own events" on events;
drop policy if exists "contributors read own announcements" on announcements;
drop policy if exists "contributors submit own opportunities" on opportunities;
drop policy if exists "contributors submit own events" on events;
drop policy if exists "contributors submit own announcements" on announcements;
drop policy if exists "admins can update opportunities" on opportunities;
drop policy if exists "admins can update events" on events;
drop policy if exists "admins can update announcements" on announcements;
drop policy if exists "admins read all opportunities" on opportunities;
drop policy if exists "admins read all events" on events;
drop policy if exists "admins read all announcements" on announcements;

create policy "contributors read own opportunities" on opportunities for select using (
  submitted_by in (select id from user_roles where auth_user_id=auth.uid() and status='active'));
create policy "contributors read own events" on events for select using (
  submitted_by in (select id from user_roles where auth_user_id=auth.uid() and status='active'));
create policy "contributors read own announcements" on announcements for select using (
  submitted_by in (select id from user_roles where auth_user_id=auth.uid() and status='active'));
create policy "reviewers read all opportunities" on opportunities for select using (is_reviewer());
create policy "reviewers read all events" on events for select using (is_reviewer());
create policy "reviewers read all announcements" on announcements for select using (is_reviewer());
create policy "contributors submit own opportunities" on opportunities for insert with check (
  is_verified_contributor() and status='pending' and submitted_by in (select id from user_roles where auth_user_id=auth.uid() and status='active'));
create policy "contributors submit own events" on events for insert with check (
  is_verified_contributor() and status='pending' and submitted_by in (select id from user_roles where auth_user_id=auth.uid() and status='active'));
create policy "contributors submit own announcements" on announcements for insert with check (
  is_verified_contributor() and status='pending' and submitted_by in (select id from user_roles where auth_user_id=auth.uid() and status='active'));
revoke update on opportunities, events, announcements from authenticated;

drop policy if exists "authenticated actors append audit events" on audit_events;
revoke insert, update, delete on audit_events from authenticated;

create or replace function record_content_audit_event()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare actor user_roles; resolved_type text;
begin
  resolved_type := case tg_table_name when 'opportunities' then 'opportunity' when 'events' then 'event' else 'announcement' end;
  select * into actor from user_roles where auth_user_id=auth.uid() limit 1;
  if tg_op='INSERT' then
    insert into audit_events(content_type,content_id,actor_type,actor_id,action,new_status)
    values(resolved_type,new.id,'contributor',coalesce(actor.id,new.submitted_by),'submitted',new.status);
  elsif old.status is distinct from new.status then
    insert into audit_events(content_type,content_id,actor_type,actor_id,action,previous_status,new_status,changes)
    values(resolved_type,new.id,case when actor.role='admin' then 'administrator' when actor.role='reviewer' then 'reviewer' else 'contributor' end,
      actor.id,case new.status when 'published' then 'published' when 'rejected' then 'rejected' when 'archived' then 'archived' else 'status_changed' end,
      old.status,new.status,jsonb_build_object('status',jsonb_build_object('from',old.status,'to',new.status)));
  end if;
  return new;
end $$;
revoke all on function record_content_audit_event() from public, authenticated;

create or replace function review_content(p_content_type text,p_content_id uuid,p_decision text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare table_name text; current_status text; actor user_roles;
begin
  if not is_reviewer() then raise exception 'Reviewer access required'; end if;
  if p_decision not in ('published','rejected') then raise exception 'Invalid review decision'; end if;
  table_name := case p_content_type when 'opportunity' then 'opportunities' when 'event' then 'events' when 'announcement' then 'announcements' else null end;
  if table_name is null then raise exception 'Invalid content type'; end if;
  execute format('select status from %I where id=$1 for update',table_name) into current_status using p_content_id;
  if current_status is null then raise exception 'Content not found'; end if;
  if current_status <> 'pending' then raise exception 'Only pending content can be reviewed'; end if;
  if p_content_type='announcement' then
    execute format('update %I set status=$1 where id=$2',table_name) using p_decision,p_content_id;
  else
    execute format('update %I set status=$1, verified=($1=''published'') where id=$2',table_name) using p_decision,p_content_id;
  end if;
  select * into actor from user_roles where auth_user_id=auth.uid();
  update audit_events set reason=nullif(trim(p_reason),'')
  where id=(select id from audit_events where content_type=p_content_type and content_id=p_content_id and actor_id=actor.id and new_status=p_decision order by created_at desc limit 1);
  return jsonb_build_object('ok',true,'status',p_decision,'content_type',p_content_type,'content_id',p_content_id);
end $$;
revoke all on function review_content(text,uuid,text,text) from public;
grant execute on function review_content(text,uuid,text,text) to authenticated;

-- Own intake remains readable; submitted evidence becomes immutable to contributors.
drop policy if exists "contributors manage own intake sessions" on intake_sessions;
drop policy if exists "contributors create own intake sessions" on intake_sessions;
drop policy if exists "contributors manage own source artifacts" on source_artifacts;
drop policy if exists "contributors manage own field suggestions" on field_suggestions;
create policy "owners and reviewers read intake sessions" on intake_sessions for select using (
  submitter_id in (select id from user_roles where auth_user_id=auth.uid()) or is_reviewer());
create policy "owners create intake sessions" on intake_sessions for insert with check (
  submitter_id in (select id from user_roles where auth_user_id=auth.uid() and status='active' and role in ('contributor','reviewer','admin')));
create policy "owners update open intake sessions" on intake_sessions for update using (
  state <> 'submitted' and submitter_id in (select id from user_roles where auth_user_id=auth.uid() and status='active'))
  with check (submitter_id in (select id from user_roles where auth_user_id=auth.uid() and status='active'));
create policy "owners and reviewers read source artifacts" on source_artifacts for select using (
  intake_session_id in (select id from intake_sessions where submitter_id in (select id from user_roles where auth_user_id=auth.uid())) or is_reviewer());
create policy "owners create artifacts for open intake" on source_artifacts for insert with check (
  intake_session_id in (select id from intake_sessions where state <> 'submitted' and submitter_id in (select id from user_roles where auth_user_id=auth.uid() and status='active')));
create policy "owners modify artifacts for open intake" on source_artifacts for update using (
  intake_session_id in (select id from intake_sessions where state <> 'submitted' and submitter_id in (select id from user_roles where auth_user_id=auth.uid() and status='active')))
  with check (intake_session_id in (select id from intake_sessions where state <> 'submitted' and submitter_id in (select id from user_roles where auth_user_id=auth.uid() and status='active')));
create policy "owners delete artifacts for open intake" on source_artifacts for delete using (
  intake_session_id in (select id from intake_sessions where state <> 'submitted' and submitter_id in (select id from user_roles where auth_user_id=auth.uid() and status='active')));
create policy "owners and reviewers read suggestions" on field_suggestions for select using (
  intake_session_id in (select id from intake_sessions where submitter_id in (select id from user_roles where auth_user_id=auth.uid())) or is_reviewer());
create policy "owners create suggestions for open intake" on field_suggestions for insert with check (
  intake_session_id in (select id from intake_sessions where state <> 'submitted' and submitter_id in (select id from user_roles where auth_user_id=auth.uid() and status='active')));

drop policy if exists "verified contributors upload intake sources" on storage.objects;
drop policy if exists "owners and admins read intake sources" on storage.objects;
drop policy if exists "owners delete intake sources" on storage.objects;
create policy "owners upload intake sources to bound path" on storage.objects for insert with check (
  bucket_id='intake-sources' and owner_id::text=auth.uid()::text and
  (storage.foldername(name))[1] in (select id::text from user_roles where auth_user_id=auth.uid() and status='active') and
  (storage.foldername(name))[2] in (select id::text from intake_sessions where state <> 'submitted' and submitter_id in (select id from user_roles where auth_user_id=auth.uid())));
create policy "owners and reviewers read private intake sources" on storage.objects for select using (
  bucket_id='intake-sources' and (owner_id::text=auth.uid()::text or is_reviewer()));
create policy "owners delete open intake sources" on storage.objects for delete using (
  bucket_id='intake-sources' and owner_id::text=auth.uid()::text and
  (storage.foldername(name))[2] in (select id::text from intake_sessions where state <> 'submitted' and submitter_id in (select id from user_roles where auth_user_id=auth.uid())));

create or replace function archive_expired_opportunities()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin update opportunities set status='archived' where status='published' and deadline < (current_date-interval '15 days'); end $$;
revoke all on function archive_expired_opportunities() from public, anon, authenticated;

create or replace function provision_user_role(p_email text,p_role text,p_status text default 'active')
returns user_roles language plpgsql security definer set search_path = public, pg_temp as $$
declare normalized_email text := lower(trim(p_email)); provisioned user_roles; actor user_roles;
begin
  if not is_admin() then raise exception 'Administrator access required'; end if;
  if p_role not in ('contributor','reviewer','admin') then raise exception 'Invalid role'; end if;
  if p_status not in ('active','needs_review') then raise exception 'Invalid status'; end if;
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Invalid email'; end if;
  insert into user_roles(email,role,status) values(normalized_email,p_role,p_status)
  on conflict(email) do update set role=excluded.role,status=excluded.status
  returning * into provisioned;
  select * into actor from user_roles where auth_user_id=auth.uid();
  insert into audit_events(content_type,actor_type,actor_id,action,changes)
  values('system','administrator',actor.id,'role_provisioned',jsonb_build_object('target_role_id',provisioned.id,'role',p_role,'status',p_status));
  return provisioned;
end $$;
revoke all on function provision_user_role(text,text,text) from public;
grant execute on function provision_user_role(text,text,text) to authenticated;

do $$ begin
  if exists(select 1 from user_roles where role not in ('contributor','reviewer','admin')) then raise exception 'RBAC postcondition failed'; end if;
  if exists(select auth_user_id from user_roles where auth_user_id is not null group by auth_user_id having count(*)>1) then raise exception 'Duplicate auth binding'; end if;
end $$;
commit;
