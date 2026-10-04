import Link from 'next/link';
import { canSubmit, getViewer } from '../../../lib/auth';
import { getMySubmissionStatuses } from '../../../lib/submissionStatus';
import SubmissionStatusPanel from '../../../components/SubmissionStatusPanel';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Your Submissions' };

export default async function SubmissionHistoryPage() {
  const viewer = await getViewer();
  if (!viewer.user) redirect('/auth/signin?next=%2Fpanther-submit%2Fsubmissions');
  if (!canSubmit(viewer)) return <div className="access-page-shell"><div className="eyebrow">Submission history</div><h1>Contributor access required</h1><p>Your account does not currently have permission to submit or view contributor submission history.</p><Link className="outline-button" href="/workspace">Return to Workspace</Link></div>;
  const submissions = await getMySubmissionStatuses();
  return <main className="submission-history-page">
    <header className="submission-history-heading"><div><div className="eyebrow">Panther Submit</div><h1>Your submissions</h1><p>Review status, requested corrections, publication, and past activity.</p></div><Link className="outline-button" href="/panther-submit">Submit something new</Link></header>
    <SubmissionStatusPanel submissions={submissions} />
  </main>;
}
