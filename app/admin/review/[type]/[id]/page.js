import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getViewer, canReview } from '../../../../../lib/auth';
import { getPendingQueue } from '../../../../../lib/adminData';
import ReviewSubmission from './ReviewSubmission';

export default async function ReviewSubmissionPage({ params }) {
  const viewer = await getViewer();
  if (!viewer.user || !canReview(viewer)) return <div className="workspace-auth-card"><h1>Reviewer access required</h1><p>This submission is restricted to approved reviewers.</p></div>;
  const { type, id } = await params;
  const key = type === 'opportunity' ? 'opportunities' : type === 'event' ? 'events' : type === 'announcement' ? 'announcements' : null;
  if (!key) return notFound();
  const queue = await getPendingQueue();
  const item = queue[key].find(row => row.id === id);
  if (!item) return notFound();
  return <div className="workspace-overview review-submission-page"><div className="review-submission-breadcrumb"><Link href="/admin/review">Review Queue</Link> / Review Submission</div><div className="workspace-page-heading"><div><div className="eyebrow">{type} · Pending review</div><h1>Review Submission</h1><p>Verify the submitted information against its official source before deciding.</p></div></div><ReviewSubmission item={item} type={type} /></div>;
}
