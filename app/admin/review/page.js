import { getViewer, canReview } from '../../../lib/auth';
import { getPendingQueue } from '../../../lib/adminData';
import ReviewQueue from './ReviewQueue';

export default async function AdminReviewPage() {
  const viewer = await getViewer();

  if (!viewer.user) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <h1 className="font-display text-xl text-purple-900 mb-2">Sign in required</h1>
        <p className="text-sm text-slate">Sign in with your PVAMU Microsoft account to reach the review queue.</p>
      </div>
    );
  }

  if (!canReview(viewer)) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <h1 className="font-display text-xl text-purple-900 mb-2">CODE review access required</h1>
        <p className="text-sm text-slate">
          The review queue is restricted to the Platform Admin and active CODE Officers. If you think this is a mistake,
          contact the CODE committee.
        </p>
      </div>
    );
  }

  const queue = await getPendingQueue();
  const total = queue.opportunities.length + queue.events.length + queue.announcements.length;

  return (
    <div className="pb-16">
      <div className="mt-9 mb-6">
        <h1 className="font-display text-2xl text-purple-900">Review queue</h1>
        <div className="text-sm text-slate mt-1">
          {total} item{total === 1 ? '' : 's'} waiting on a decision — approve publishes it site-wide,
          reject sends it back.
        </div>
      </div>
      <ReviewQueue queue={queue} />
    </div>
  );
}
