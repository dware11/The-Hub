'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { createIssueReport } from '../app/report/actions';

const CONTENT_ISSUES = ['Broken link', 'Wrong date/deadline', 'Wrong information', 'Duplicate', 'Event canceled/changed', 'Other'];
const SITE_ISSUES = ['Sign-in issue', 'Submission issue', 'Calendar/display issue', 'Page error', 'Accessibility issue', 'Other'];

export default function ReportIssueForm({ contentType = null, contentId = null, label = 'Report a problem' }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');
  const issues = contentType ? CONTENT_ISSUES : SITE_ISSUES;

  async function submit(event) {
    event.preventDefault();
    setStatus('Sending…');
    const form = new FormData(event.currentTarget);
    const result = await createIssueReport({
      contentType,
      contentId,
      issueType: form.get('issue_type'),
      description: form.get('description'),
      reporterEmail: form.get('reporter_email'),
      pageUrl: pathname,
    });
    if (result.ok) {
      event.currentTarget.reset();
      setStatus('Thank you. Your report was sent to the Hub team.');
    } else setStatus(result.error || 'The report could not be sent.');
  }

  return <div className="issue-report">
    <button type="button" className="issue-report-toggle" aria-expanded={open} onClick={() => setOpen(value => !value)}>{label}</button>
    {open && <form className="issue-report-form" onSubmit={submit}>
      <label>Issue type<select name="issue_type" required defaultValue=""><option value="" disabled>Select one</option>{issues.map(issue => <option key={issue}>{issue}</option>)}</select></label>
      <label>What happened?<textarea name="description" required maxLength={3000} rows={3} /></label>
      <label>Email <span>(optional)</span><input name="reporter_email" type="email" autoComplete="email" /></label>
      <button type="submit">Send report</button>
      {status && <p role="status" aria-live="polite">{status}</p>}
    </form>}
  </div>;
}
