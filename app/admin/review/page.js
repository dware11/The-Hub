import { getViewer, canReview } from '../../../lib/auth';
import { Suspense } from 'react';
import { getPendingQueue } from '../../../lib/adminData';
import ReviewQueue from './ReviewQueue';
import RecommendationPanel from './RecommendationPanel';
import { getAnnouncements } from '../../../lib/data';

export default async function AdminReviewPage() {
  const viewer = await getViewer();

  if (!viewer.user) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <h1 className="font-display text-xl text-purple-900 mb-2">Sign in required</h1>
        <p className="text-sm text-slate">Sign in with your verified email to reach the review queue.</p>
      </div>
    );
  }

  if (!canReview(viewer)) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <h1 className="font-display text-xl text-purple-900 mb-2">Reviewer access required</h1>
        <p className="text-sm text-slate">
          The review queue is restricted to approved C.O.D.E. reviewers and administrators. If you think this is a mistake, reach out to
          the C.O.D.E. team.
        </p>
      </div>
    );
  }

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
          reject sends it back.
          </p>
        </div>
      </div>
      <Suspense fallback={<p className="text-sm text-slate" role="status">Loading review filters…</p>}><ReviewQueue queue={queue} /></Suspense>
      <RecommendationPanel announcements={await getAnnouncements()} />
    </div>
  );
}
