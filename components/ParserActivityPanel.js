'use client';

import { useMemo, useState } from 'react';

const text = (value) => String(value || '').replaceAll('_', ' ');
const displayDate = (value) => value ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not completed';

function activityOutcome(activity) {
  const failedSources = activity.sources.filter((source) => source.status === 'failed');
  const pendingSources = activity.sources.filter((source) => ['pending', 'processing'].includes(source.status));
  if (failedSources.length) return { tone: 'failed', label: 'Extraction failed', description: failedSources.flatMap((source) => source.warnings).filter(Boolean).join(' ') || 'The source could not be processed automatically.' };
  if (activity.state === 'failed') return { tone: 'failed', label: 'Submission failed', description: activity.extractedFields.length ? `Extraction produced ${activity.extractedFields.length} field suggestions, but the final submission did not complete.` : 'The intake stopped before a completed submission was created.' };
  if (activity.state === 'submitted') return { tone: 'success', label: 'Submitted', description: activity.extractedFields.length ? `${activity.extractedFields.length} fields were extracted before submission.` : 'The submission completed with manual entry or no saved field suggestions.' };
  if (pendingSources.length) return { tone: 'incomplete', label: 'Incomplete source processing', description: 'The source never reached a final processing state. The workflow may have been interrupted.' };
  return { tone: 'incomplete', label: 'Incomplete workflow', description: activity.extractedFields.length ? `${activity.extractedFields.length} fields were extracted, but the workflow did not reach submission.` : 'No extracted fields or completed submission were recorded. The workflow may have been abandoned.' };
}

export default function ParserActivityPanel({ activities }) {
  const [outcome, setOutcome] = useState('');
  const [contentType, setContentType] = useState('');
  const [sourceType, setSourceType] = useState('');
  const [feedback, setFeedback] = useState('');
  const decorated = useMemo(() => (activities || []).map((activity) => ({ ...activity, outcome: activityOutcome(activity) })), [activities]);
  const sourceTypes = useMemo(() => [...new Set(decorated.flatMap((activity) => activity.sources.map((source) => source.type)).filter(Boolean))].sort(), [decorated]);
  const shown = useMemo(() => decorated.filter((activity) =>
    (!outcome || activity.outcome.tone === outcome)
    && (!contentType || activity.contentType === contentType)
    && (!sourceType || activity.sources.some((source) => source.type === sourceType))
    && (!feedback || (feedback === 'with_feedback' ? Boolean(activity.feedback) : !activity.feedback))
  ), [decorated, outcome, contentType, sourceType, feedback]);

  if (activities === null) return <section className="system-insights-parser-activity"><div className="eyebrow">Parser activity</div><p className="workspace-status">Parser activity is currently unavailable. Submission processing remains usable.</p></section>;
  return <details className="system-insights-parser-activity">
    <summary><span><span className="eyebrow">Parser activity</span><strong>View parser activity</strong><small>Failures, incomplete runs, successful extractions, and saved feedback</small></span><span>{activities.length} recent attempt{activities.length === 1 ? '' : 's'}</span></summary>
    <div className="parser-activity-panel">
      <header><div><h2>Recent extraction attempts</h2><p>Private Super Admin diagnostics. Source text and extracted values are intentionally not shown.</p></div><span>{shown.length} shown</span></header>
      <div className="parser-activity-filters" aria-label="Filter parser activity">
        <label><span>Outcome</span><select value={outcome} onChange={(event) => setOutcome(event.target.value)}><option value="">All outcomes</option><option value="failed">Failures</option><option value="incomplete">Incomplete</option><option value="success">Submitted</option></select></label>
        <label><span>Content</span><select value={contentType} onChange={(event) => setContentType(event.target.value)}><option value="">All content</option><option value="event">Events</option><option value="opportunity">Opportunities</option><option value="announcement">Announcements</option></select></label>
        <label><span>Source</span><select value={sourceType} onChange={(event) => setSourceType(event.target.value)}><option value="">All sources</option>{sourceTypes.map((type) => <option value={type} key={type}>{text(type)}</option>)}</select></label>
        <label><span>Feedback</span><select value={feedback} onChange={(event) => setFeedback(event.target.value)}><option value="">All attempts</option><option value="with_feedback">With feedback</option><option value="without_feedback">Without feedback</option></select></label>
      </div>
      {!shown.length ? <div className="workspace-empty">No parser attempts match these filters.</div> : <div className="parser-activity-list">{shown.map((activity) => <article className={`parser-activity-card parser-activity-${activity.outcome.tone}`} key={activity.id}>
        <div className="parser-activity-heading"><div><span className="parser-activity-status">{activity.outcome.label}</span><h3>{text(activity.contentType)} extraction</h3><p>{displayDate(activity.createdAt)} · {activity.submitter}</p></div><span>{activity.sources.map((source) => text(source.type)).join(' + ') || 'No source retained'}</span></div>
        <p className="parser-activity-description">{activity.outcome.description}</p>
        <dl className="parser-activity-facts"><div><dt>Workflow state</dt><dd>{text(activity.state)}</dd></div><div><dt>Submitted</dt><dd>{displayDate(activity.submittedAt)}</dd></div><div><dt>Extracted fields</dt><dd>{activity.extractedFields.length ? activity.extractedFields.map(text).join(', ') : 'None recorded'}</dd></div><div><dt>Needs verification</dt><dd>{activity.reviewFields.length ? activity.reviewFields.map(text).join(', ') : 'None recorded'}</dd></div></dl>
        <details><summary>View parser details</summary><div className="parser-activity-details"><div><strong>Sources</strong>{activity.sources.length ? <ul>{activity.sources.map((source, index) => <li key={`${activity.id}-${index}`}><span>{source.filename || text(source.type)}</span><small>{text(source.status)}{source.mimeType ? ` · ${source.mimeType}` : ''}</small>{source.warnings.map((warning, warningIndex) => <p key={`${warningIndex}-${warning}`}>{warning}</p>)}</li>)}</ul> : <p>No source record was retained.</p>}</div><div><strong>Parser</strong><p>{activity.provider || 'Not recorded'}{activity.parserVersion ? ` · ${activity.parserVersion}` : ''}</p>{activity.reviewReasons.map((reason) => <p key={reason}>{reason}</p>)}</div></div></details>
        <div className="parser-activity-feedback"><strong>Parser review</strong>{activity.feedback ? <><span>{text(activity.feedback.rating)}</span><p>{activity.feedback.note || 'No written description was provided.'}</p>{activity.feedback.issueFields.length ? <small>Fields marked: {activity.feedback.issueFields.map(text).join(', ')}</small> : null}</> : <p>No parser feedback was submitted for this attempt.</p>}</div>
      </article>)}</div>}
    </div>
  </details>;
}
