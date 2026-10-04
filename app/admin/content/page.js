import { getViewer, isAdmin, isSuperAdmin } from '../../../lib/auth';
import { createServerSupabaseClient, isDemoMode } from '../../../lib/supabaseServerClient';
import { sampleEvents, sampleOpportunities, sampleAnnouncements } from '../../../lib/sampleData';
import ContentManager from './ContentManager';
import RecommendationAdmin from './RecommendationAdmin';
import { getFeatureRecommendations } from '../../../lib/recommendationData';
import { getContentEditAudit } from '../../../lib/auditData';

const MANAGED_STATUSES = ['pending', 'resubmitted', 'needs_correction', 'published', 'rejected', 'unpublished', 'archived', 'deleted', 'expired_before_review'];
const CONTENT_TABLES = [
  ['events', 'event', 'events_submitted_by_fkey'],
  ['opportunities', 'opportunity', 'opportunities_submitted_by_fkey'],
  ['announcements', 'announcement', 'announcements_submitted_by_fkey'],
];

async function rows(includeAvailability = false) {
  if (isDemoMode) {
    return [
      ...sampleEvents.slice(0, 4).map((item) => ({ ...item, content_type: 'event', status: 'published' })),
      ...sampleOpportunities.slice(0, 3).map((item) => ({ ...item, content_type: 'opportunity', status: 'published' })),
      ...sampleAnnouncements.map((item) => ({ ...item, content_type: 'announcement', status: 'published' })),
    ];
  }

  const supabase = await createServerSupabaseClient();
  const result = [];
  for (const [table, type, submittedByKey] of CONTENT_TABLES) {
    const { data, error } = await supabase
      .from(table)
      .select(`*, submitted_by_user:user_roles!${submittedByKey}(id,full_name,email)`)
      .in('status', MANAGED_STATUSES)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`The ${type} lifecycle records could not be loaded.`);
    result.push(...(data || []).map((item) => ({ ...item, content_type: type })));
  }

  if (!includeAvailability) return result;
  const { data, error } = await supabase
    .from('opportunity_availability_reviews')
    .select('opportunity_id,last_verified_at,next_review_at');
  if (error) throw new Error('Availability review records could not be loaded.');
  const reviewMap = new Map((data || []).map((review) => [review.opportunity_id, review]));
  return result.map((row) => row.content_type === 'opportunity'
    ? { ...row, availability_review: reviewMap.get(row.id) || null }
    : row);
}

export default async function ContentPage() {
  const viewer = await getViewer();
  if (!viewer.user || !isAdmin(viewer)) {
    return <div className="auth-card"><h1>Administrator access required</h1><p>Content Management is restricted to administrators and super administrators.</p></div>;
  }

  const superAdmin = isSuperAdmin(viewer);
  const [contentRows, auditEdits, recommendations] = await Promise.all([
    rows(true),
    getContentEditAudit(),
    getFeatureRecommendations(),
  ]);
  const featured = contentRows.filter((row) => row.is_featured && row.status === 'published');
  const published = contentRows.filter((row) => row.status === 'published');
  const pending = contentRows.filter((row) => ['pending', 'resubmitted'].includes(row.status));
  const counts = {
    opportunity: contentRows.filter((row) => row.content_type === 'opportunity').length,
    event: contentRows.filter((row) => row.content_type === 'event').length,
    announcement: contentRows.filter((row) => row.content_type === 'announcement').length,
  };

  return <div className="review-page workspace-subpage">
    <div className="workspace-page-heading"><div><div className="eyebrow">Workspace operations</div><h1>Content Management</h1><p>Locate content across its full administrative lifecycle. Only published records are public; every privileged action remains audited.</p></div></div>
    <div className="content-overview-grid">
      <section className="content-summary-card content-summary-compact" aria-label="Content summary">
        <div className="eyebrow">Content summary</div>
        <div className="content-summary-total"><strong>{published.length}</strong><span>published</span></div>
        <div className="content-summary-counts"><span>{pending.length} pending review</span><span>{counts.opportunity} opportunities</span><span>{counts.event} events</span><span>{counts.announcement} announcements</span></div>
      </section>
      <RecommendationAdmin rows={recommendations} featured={featured} />
    </div>
    <ContentManager rows={contentRows} auditEdits={auditEdits} superAdmin={superAdmin} availabilityAccess />
  </div>;
}
