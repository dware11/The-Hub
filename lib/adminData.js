import { createServerSupabaseClient, isDemoMode } from './supabaseServerClient';
import {
  samplePendingOpportunities,
  samplePendingEvents,
  samplePendingAnnouncements,
} from './sampleData';

// Admin-only reads/writes for the review queue. Always runs server-side
// with the signed-in admin's own session -- there's no service-role
// bypass; the database's is_admin() RLS policies (see schema.sql) are
// what actually gate these updates from succeeding.

export async function getPendingQueue() {
  if (isDemoMode) {
    return {
      opportunities: samplePendingOpportunities,
      events: samplePendingEvents,
      announcements: samplePendingAnnouncements,
    };
  }
  const supabase = await createServerSupabaseClient();
  const submitter = 'submitted_by:user_roles(full_name, email, org)';

  const [opportunities, events, announcements] = await Promise.all([
    supabase.from('opportunities').select(`*, ${submitter}`).eq('status', 'pending').order('created_at', { ascending: true }),
    supabase.from('events').select(`*, ${submitter}`).eq('status', 'pending').order('created_at', { ascending: true }),
    supabase.from('announcements').select(`*, ${submitter}`).eq('status', 'pending').order('created_at', { ascending: true }),
  ]);

  return {
    opportunities: opportunities.data || [],
    events: events.data || [],
    announcements: announcements.data || [],
  };
}

const TABLES = { opportunity: 'opportunities', event: 'events', announcement: 'announcements' };

export async function setItemStatus(type, id, status) {
  if (isDemoMode) return { ok: true, demo: true };
  const table = TABLES[type];
  if (!table) return { ok: false, error: 'Unknown content type' };
  const supabase = await createServerSupabaseClient();
  const patch = { status };
  if (status === 'published' && type !== 'announcement') patch.verified = true;
  const { error } = await supabase.from(table).update(patch).eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
