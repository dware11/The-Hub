-- Persist reviewer correction requests without changing publish/reject state.
create or replace function public.request_review_correction(p_content_type text,p_content_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor user_roles; current_status text; evidence_id uuid;
begin
  if not is_reviewer() then raise exception 'Reviewer access required'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'Correction reason required'; end if;
  if p_content_type not in ('opportunity','event','announcement') then raise exception 'Invalid content type'; end if;
  select * into actor from user_roles where auth_user_id=auth.uid() and status='active' for update;
  execute format('select status from %I where id=$1',case p_content_type when 'opportunity' then 'opportunities' when 'event' then 'events' else 'announcements' end) into current_status using p_content_id;
  if current_status is null then raise exception 'Content not found'; end if;
  if current_status <> 'pending' then raise exception 'Only pending content can receive a correction request'; end if;
  insert into review_verification_evidence(content_type,content_id,reviewer_role_id,reviewer_notes,decision,completed_at,updated_at)
  values(p_content_type,p_content_id,actor.id,nullif(trim(p_reason),''),'needs_correction',now(),now())
  on conflict(content_type,content_id,reviewer_role_id) do update set reviewer_notes=excluded.reviewer_notes,decision='needs_correction',completed_at=now(),updated_at=now()
  returning id into evidence_id;
  insert into audit_events(content_type,content_id,actor_type,actor_id,action,reason,changes)
  values(p_content_type,p_content_id,'reviewer',actor.id,'review_correction_requested',nullif(trim(p_reason),''),jsonb_build_object('decision','needs_correction','evidence_id',evidence_id));
  return jsonb_build_object('ok',true,'evidence_id',evidence_id,'status','needs_correction');
end $$;
revoke all on function public.request_review_correction(text,uuid,text) from public;
grant execute on function public.request_review_correction(text,uuid,text) to authenticated;
