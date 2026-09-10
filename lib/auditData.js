import { createServerSupabaseClient, isDemoMode } from './supabaseServerClient';

export async function getAuditEvents() {
  if (isDemoMode) return { rows: [], demo: true };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from('audit_events').select('*, actor:user_roles!audit_events_actor_id_fkey(full_name,email,role)').order('created_at', { ascending: false }).limit(500);
  if (error) throw new Error('Audit history unavailable');
  const rows = data || [];
  const idsByType = rows.reduce((map, row) => {
    if (row.content_id && ['opportunity','event','announcement'].includes(row.content_type)) (map[row.content_type] ||= []).push(row.content_id);
    return map;
  }, {});
  const tables = { opportunity: 'opportunities', event: 'events', announcement: 'announcements' };
  const titlePairs = await Promise.all(Object.entries(idsByType).map(async ([type, ids]) => {
    const { data: records } = await supabase.from(tables[type]).select('id,title').in('id', [...new Set(ids)]);
    return (records || []).map(record => [`${type}:${record.id}`, record.title]);
  }));
  const titles = new Map(titlePairs.flat());
  return { rows: rows.map(row => ({ ...row, target_title: titles.get(`${row.content_type}:${row.content_id}`) || row.changes?.record_snapshot?.title || null })), demo: false };
}
