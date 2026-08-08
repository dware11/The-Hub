import { createClient, isDemoMode } from './supabaseClient';
import { sampleOpportunities, sampleEvents, sampleAnnouncements } from './sampleData';

function requireData(data, error, label) {
  if (error) throw new Error('Panther Hub could not load ' + label + '. Please try again shortly.');
  return data || [];
}

// Sample data is used only in explicit demo mode. Live query failures throw,
// allowing the application to show a real degraded/error state.

function filterByMajor(items, major) {
  if (!major || major === 'All majors') return items;
  return items.filter((item) => (item.majors || []).includes(major) || (item.majors || []).includes('All majors'));
}

export async function getOpportunities(major) {
  if (isDemoMode) return filterByMajor(sampleOpportunities, major);
  const supabase = createClient();
  let query = supabase.from('opportunities').select('*').eq('status', 'published').order('deadline', { ascending: true });
  if (major && major !== 'All majors') query = query.contains('majors', [major]);
  const { data, error } = await query;
  return requireData(data, error, 'opportunities');
}

export async function getOpportunity(id) {
  if (isDemoMode) return sampleOpportunities.find((o) => o.id === id) || null;
  const supabase = createClient();
  const { data, error } = await supabase.from('opportunities').select('*').eq('id', id).single();
  if (error) return null;
  return data;
}

export async function getEvents(major) {
  if (isDemoMode) return filterByMajor(sampleEvents, major);
  const supabase = createClient();
  let query = supabase.from('events').select('*').eq('status', 'published').order('date', { ascending: true });
  if (major && major !== 'All majors') query = query.contains('majors', [major]);
  const { data, error } = await query;
  return requireData(data, error, 'events');
}

export async function getEvent(id) {
  if (isDemoMode) return sampleEvents.find((e) => e.id === id) || null;
  const supabase = createClient();
  const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
  if (error) return null;
  return data;
}

// Pulls the top 5-7 items for the weekly digest email: closing-soon
// deadlines, employer/sponsor events coming up, and pinned/recent
// announcements. Used by app/api/cron/weekly-digest/route.js. These are
// all published, publicly-readable rows, so this works with just the
// anon key -- no service-role key needed.
export async function getDigestItems() {
  if (isDemoMode) {
    return {
      opportunities: sampleOpportunities.slice(0, 4),
      events: sampleEvents.slice(0, 3),
      announcements: sampleAnnouncements.filter((a) => a.pinned).slice(0, 2),
    };
  }
  const supabase = createClient();
  const in21Days = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [opportunities, events, announcements] = await Promise.all([
    supabase
      .from('opportunities')
      .select('*')
      .eq('status', 'published')
      .lte('deadline', in21Days)
      .order('deadline', { ascending: true })
      .limit(4),
    supabase
      .from('events')
      .select('*')
      .eq('status', 'published')
      .gte('date', new Date().toISOString().slice(0, 10))
      .order('date', { ascending: true })
      .limit(3),
    supabase
      .from('announcements')
      .select('*')
      .eq('status', 'published')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(2),
  ]);

  return {
    opportunities: opportunities.data || [],
    events: events.data || [],
    announcements: announcements.data || [],
  };
}

export async function getAnnouncements() {
  if (isDemoMode) return sampleAnnouncements;
  const supabase = createClient();
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false });
  return requireData(data, error, 'announcements');
}

// Submit a new opportunity/event/announcement -- lands in the review
// queue with status 'pending'. In demo mode this just logs, since
// there's no real database to write to yet. `submittedById` is the
// signed-in contributor's user_roles.id (RLS requires them to be a
// verified, active contributor -- see supabase/schema.sql).
export async function submitContent(type, payload, submittedById) {
  if (isDemoMode) {
    console.log('[demo mode] would submit:', type, payload);
    return { ok: true, demo: true };
  }
  const supabase = createClient();
  const table = type === 'opportunity' ? 'opportunities' : type === 'event' ? 'events' : 'announcements';
  const { data, error } = await supabase
    .from(table)
    .insert([{ ...payload, submitted_by: submittedById, status: 'pending' }])
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}
