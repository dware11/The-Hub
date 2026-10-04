import { getViewer, canReview } from '../../../lib/auth';
import { Suspense } from 'react';
import { getPendingQueue } from '../../../lib/adminData';
import ReviewQueue from './ReviewQueue';
import RecommendationPanel from './RecommendationPanel';
import { getAnnouncements } from '../../../lib/data';
import { redirect } from 'next/navigation';

export default async function AdminReviewPage() {
  const viewer = await getViewer();

  if (!viewer.user) redirect('/auth/signin?next=%2Fadmin%2Freview');
  if (!canReview(viewer)) redirect('/workspace');

  const queue = await getPendingQueue();
  const total = queue.opportunities.length + queue.events.length + queue.announcements.length;

  return (
    <div className="review-page workspace-subpage">
      <div className="workspace-page-heading">
        <div>
          <div className="eyebrow">Workspace review</div>
          <h1>Review Queue</h1>
          <p>
          {total} item{total === 1 ? '' : 's'} waiting on a decision — approve publishes it site-wide,
          correction sends it back to the contributor, while rejection closes it without publishing.
          </p>
        </div>
      </div>
      <Suspense fallback={<p className="text-sm text-slate" role="status">Loading review filters…</p>}><ReviewQueue queue={queue} /></Suspense>
      <RecommendationPanel announcements={await getAnnouncements()} />
    </div>
  );
}
