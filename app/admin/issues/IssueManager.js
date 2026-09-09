'use client';

import { useState } from 'react';
import { updateIssueStatus } from '../../report/actions';

export default function IssueManager({ issues }) {
  const [message, setMessage] = useState('');
  async function update(id, status) {
    setMessage('Saving…');
    const result = await updateIssueStatus(id, status);
    setMessage(result.ok ? 'Issue status updated.' : result.error);
  }
  return <section className="issues-panel"><p className="workspace-status" role="status" aria-live="polite">{message}</p>{issues.length ? <div className="issues-table"><div className="issues-row issues-header"><span>Status</span><span>Issue</span><span>Page</span><span>Reported</span><span>Actions</span></div>{issues.map(issue => <article className="issues-row" key={issue.id}><span className={`issue-status issue-${issue.status}`}>{issue.status.replace('_', ' ')}</span><span><strong>{issue.issue_type}</strong><small>{issue.description}</small>{issue.reporter_email && <small>{issue.reporter_email}</small>}</span><span><a href={issue.page_url}>{issue.content_type || 'Site'} ↗</a></span><time>{new Date(issue.created_at).toLocaleDateString()}</time><span className="issue-actions">{issue.status === 'open' && <button onClick={() => update(issue.id, 'in_review')}>Mark in review</button>}{issue.status !== 'resolved' && <button onClick={() => update(issue.id, 'resolved')}>Resolve</button>}</span></article>)}</div> : <div className="workspace-empty">No issue reports yet.</div>}</section>;
}
