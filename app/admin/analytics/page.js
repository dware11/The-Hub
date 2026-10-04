import { getViewer, canReview } from '../../../lib/auth';
import Link from 'next/link';
import { getEngagementMetrics } from '../../../lib/engagementData';
import { getPublishedMetrics, getSubmissionMetrics } from '../../../lib/adminData';
import { isDemoMode } from '../../../lib/supabaseServerClient';
import AnalyticsDashboard from './AnalyticsDashboard';
import { redirect } from 'next/navigation';

export default async function AnalyticsPage() {
  const viewer = await getViewer();
  if (!viewer.user) redirect('/auth/signin?next=%2Fadmin%2Fanalytics');
  if (!canReview(viewer)) redirect('/workspace');
  const [engagement, submissions, published] = await Promise.all([getEngagementMetrics(), getSubmissionMetrics(), getPublishedMetrics()]);
  return <div className="workspace-overview"><div className="workspace-page-heading"><div><div className="eyebrow">Workspace analytics</div><h1>Analytics</h1><p>Understand publishing activity and how students use the Hub. Totals are privacy-safe aggregate interactions, not unique students.</p></div></div><AnalyticsDashboard engagement={engagement} submissions={submissions} published={published} demo={isDemoMode} /></div>;
}
