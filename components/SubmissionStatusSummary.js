import Link from 'next/link';

export default function SubmissionStatusSummary({ submissions = [] }) {
  const attention = submissions.filter((item) => item.status === 'needs_correction').length;
  return <section className="submission-status-summary" aria-labelledby="submission-summary-title">
    <div>
      <div className="eyebrow">Your submissions</div>
      <h2 id="submission-summary-title">Submission history</h2>
      <p>{attention ? `${attention} submission${attention === 1 ? '' : 's'} need your attention.` : 'Review pending, published, corrected, and rejected submissions in one place.'}</p>
    </div>
    <div className="submission-status-summary-count"><strong>{submissions.length}</strong><span>saved submission{submissions.length === 1 ? '' : 's'}</span></div>
    <Link className="outline-button" href="/panther-submit/submissions">View submissions</Link>
  </section>;
}
