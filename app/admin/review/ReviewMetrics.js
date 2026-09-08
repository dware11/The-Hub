'use client';

import { useMemo, useState } from 'react';
import { engagementActionCount, waitingMoreThanThreeDays } from '../../../lib/reviewMetrics';

const WINDOWS = [['week', 'Week'], ['month', 'Month'], ['all', 'All time']];
function Metric({ label, value }) {
  return <div className="review-metric"><strong>{Number.isFinite(value) ? value : '—'}</strong><span>{label}</span>{!Number.isFinite(value) && <small>Unavailable</small>}</div>;
}

const RATING_LABELS = { accurate: 'Accurate', minor_edits: 'Minor edits', major_edits: 'Major edits', failed: 'Failed extraction' };

export default function ReviewMetrics({ metrics, engagementMetrics, feedbackMetrics, queue, isSuperAdmin = false }) {
  const [window, setWindow] = useState('week');
  const current = metrics[window] || {};
  const engagement = engagementMetrics?.[window] || { available: false, counts: {} };
  const feedback = feedbackMetrics?.[window] || { available: false, ratings: {}, issues: {} };
  const topIssues = Object.entries(feedback.issues || {}).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const overdue = useMemo(() => waitingMoreThanThreeDays(queue), [queue]);
  return <aside className="review-impact" aria-labelledby="review-impact-title">
    <div className="eyebrow">Operations snapshot</div>
    <h2 id="review-impact-title">Submission impact</h2>
    <div className="review-window-tabs" role="group" aria-label="Submission metric time window">
      {WINDOWS.map(([value, label]) => <button type="button" key={value} aria-pressed={window === value} className={window === value ? 'active' : ''} onClick={() => setWindow(value)}>{label}</button>)}
    </div>
    <p className="review-window-status" aria-live="polite">Showing submissions from {window === 'week' ? 'the trailing 7 days' : window === 'month' ? 'the trailing 30 days' : 'all available history'}.</p>
    {current.partial && <p className="review-partial" role="status">Some provider totals are unavailable; only returned counts are shown.</p>}
    <div className="review-metrics-grid">
      <Metric label="Total submissions" value={current.total} />
      <Metric label="Submitted events" value={current.events} />
      <Metric label="Submitted opportunities" value={current.opportunities} />
      <Metric label="Submitted announcements" value={current.announcements} />
      <Metric label="Pending more than 3 days" value={overdue} />
    </div>
    <p className="review-metric-note">“Pending more than 3 days” means items still awaiting a decision whose submitted timestamp is older than three full days. It reflects the current queue and does not change with the submission window.</p>
    <div className="review-engagement-summary">
      <div className="eyebrow">Privacy-safe aggregate activity</div>
      <h3>Student engagement</h3>
      {!engagement.available && <p className="review-partial" role="status">Engagement totals are unavailable. Review actions remain fully usable.</p>}
      <div className="review-metrics-grid">
        <Metric label="Opportunity detail views" value={engagementActionCount(engagement, 'opportunity', 'detail_view')} />
        <Metric label="Application-link clicks" value={engagementActionCount(engagement, 'opportunity', 'application_click')} />
        <Metric label="Event detail views" value={engagementActionCount(engagement, 'event', 'detail_view')} />
        <Metric label="Event registrations" value={engagementActionCount(engagement, 'event', 'registration_click')} />
        <Metric label="Event calendar actions" value={engagementActionCount(engagement, 'event', ['calendar_outlook', 'calendar_google'])} />
        <Metric label="Announcement page views" value={engagementActionCount(engagement, 'announcement', 'list_view')} />
      </div>
      <p className="review-metric-note">Totals are interactions, not unique students. No IP address, account identifier, email, user agent, referrer, cookie, or exact interaction timestamp is stored.</p>
    </div>
    {isSuperAdmin && <div className="review-engagement-summary">
      <div className="eyebrow">Optional contributor feedback</div>
      <h3>Parser quality</h3>
      {!feedback.available && <p className="review-partial" role="status">Parser feedback totals are unavailable. Submission and review remain fully usable.</p>}
      <div className="review-metrics-grid">
        {Object.entries(RATING_LABELS).map(([rating, label]) => <Metric key={rating} label={label} value={feedback.available ? Number(feedback.ratings?.[rating] || 0) : null} />)}
        <Metric label="Feedback responses" value={feedback.available ? Number(feedback.total || 0) : null} />
      </div>
      {topIssues.length > 0 && <div className="review-feedback-issues"><strong>Most-reported fields</strong><ol>{topIssues.map(([field, count]) => <li key={field}>{field.replaceAll('_', ' ')} <span>{count}</span></li>)}</ol></div>}
      <p className="review-metric-note">Optional feedback stores only a rating, selected field names, and a short note tied to the submitter-owned intake. It does not store corrected values or source text.</p>
    </div>}
  </aside>;
}
