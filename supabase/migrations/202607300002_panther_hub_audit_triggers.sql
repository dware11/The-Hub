-- Append audit events automatically for submission and status changes.

begin;

create or replace function record_content_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_actor_id uuid;
  resolved_actor_type text;
  resolved_action text;
  resolved_content_type text;
begin
  resolved_content_type := case tg_table_name
    when 'opportunities' then 'opportunity'
    when 'events' then 'event'
    when 'announcements' then 'announcement'
  end;

  select id into resolved_actor_id
  from user_roles
  where lower(email) = lower(auth.jwt() ->> 'email')
  limit 1;

  if tg_op = 'INSERT' then
    resolved_actor_id := coalesce(resolved_actor_id, new.submitted_by);
    resolved_actor_type := 'contributor';
    resolved_action := 'submitted';

    insert into audit_events (
      content_type, content_id, actor_type, actor_id,
      action, previous_status, new_status, changes
    ) values (
      resolved_content_type, new.id, resolved_actor_type, resolved_actor_id,
      resolved_action, null, new.status, '{}'::jsonb
    );
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    resolved_actor_type := case
      when is_admin() then 'administrator'
      else 'contributor'
    end;
    resolved_action := case new.status
      when 'published' then 'published'
      when 'rejected' then 'rejected'
      when 'archived' then 'archived'
      else 'status_changed'
    end;

    insert into audit_events (
      content_type, content_id, actor_type, actor_id,
      action, previous_status, new_status, changes
    ) values (
      resolved_content_type, new.id, resolved_actor_type, resolved_actor_id,
      resolved_action, old.status, new.status,
      jsonb_build_object('status', jsonb_build_object('from', old.status, 'to', new.status))
    );
  end if;

  return new;
end;
$$;

drop trigger if exists opportunities_audit on opportunities;
create trigger opportunities_audit
  after insert or update on opportunities
  for each row execute function record_content_audit_event();

drop trigger if exists events_audit on events;
create trigger events_audit
  after insert or update on events
  for each row execute function record_content_audit_event();

drop trigger if exists announcements_audit on announcements;
create trigger announcements_audit
  after insert or update on announcements
  for each row execute function record_content_audit_event();

commit;
