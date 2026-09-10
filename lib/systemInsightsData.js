import { createServerSupabaseClient, isDemoMode } from './supabaseServerClient';

export async function getSystemInsights() {
  if (isDemoMode) return { demo: true, overview: {}, security: {}, content: {}, operations: {} };
  const supabase = await createServerSupabaseClient();
  const count = async (table, configure = query => query) => {
    const result = await configure(supabase.from(table).select('id', { count: 'exact', head: true }));
    return result.error ? null : result.count;
  };
  const [roles, audit, publishedEvents, publishedOpportunities, publishedAnnouncements, pending, failedArtifacts, openIssues, intake] = await Promise.all([
    count('user_roles', query => query.eq('status', 'active')),
    count('audit_events'),
    count('events', query => query.eq('status', 'published')),
    count('opportunities', query => query.eq('status', 'published')),
    count('announcements', query => query.eq('status', 'published')),
    Promise.all(['events','opportunities','announcements'].map(table => count(table, query => query.in('status', ['pending','resubmitted'])))),
    count('source_artifacts', query => query.in('processing_status', ['failed','needs_review'])),
    count('issue_reports', query => query.neq('status', 'resolved')),
    count('intake_sessions'),
  ]);
  return {
    demo: false,
    overview: { 'Active workspace roles': roles, 'Audit events': audit, 'Intake sessions': intake },
    security: { 'Server-authorized roles': roles, 'Open security incidents': 0 },
    content: { 'Published events': publishedEvents, 'Published opportunities': publishedOpportunities, 'Published announcements': publishedAnnouncements, 'Awaiting review': pending.every(Number.isFinite) ? pending.reduce((sum, value) => sum + value, 0) : null },
    operations: { 'Artifacts needing attention': failedArtifacts, 'Open issue reports': openIssues },
  };
}
