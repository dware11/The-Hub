import { createServerSupabaseClient, isDemoMode } from './supabaseServerClient';

export async function getAuditEvents() {
  if (isDemoMode) return { rows: [], demo: true };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from('audit_events').select('*').order('created_at', { ascending: false }).limit(500);
  if (error) throw new Error('Audit history unavailable');
  return { rows: data || [], demo: false };
}
