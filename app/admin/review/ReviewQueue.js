'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { activeReviewType, boundedReviewItems, reviewQueueCounts } from '../../../lib/reviewQueue';
import { deadlineLabel } from '../../../lib/opportunityOptions';

const PAGE_SIZE = 6;
const SECTIONS = [
  ['opportunities', 'opportunity', 'Opportunities'],
  ['events', 'event', 'Events'],
  ['announcements', 'announcement', 'Announcements'],
];
const FILTERS = [['all', 'All'], ...SECTIONS.map(([key, , label]) => [key, label])];

function age(value) {
  const hours = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 36e5));
  return hours < 24 ? `${hours} hours` : `${Math.floor(hours / 24)} days`;
}

function ageDays(value) { return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 864e5)); }
function priority(item) { const days=ageDays(item.created_at); const target=item.deadline||item.date; const until=target?Math.ceil((new Date(`${target}T23:59:59`).getTime()-Date.now())/864e5):null; if(days>=5||(until!==null&&until>=0&&until<=3))return 'urgent'; if(days>=3||(until!==null&&until<=7))return 'warning'; return 'normal'; }

function submitter(item) {
  const person = item.submitted_by;
  if (person?.full_name && person?.org) return `${person.full_name} / ${person.org}`;
  return person?.full_name || person?.email || person?.org || item.org || item.source || 'Unknown source';
}

function SourceLinks({ item }) {
  const links = [
    [item.source_url, 'Official source'],
    [item.registration_link, 'Registration link'],
    [item.link, 'Application link'],
    [item.flyer_url, 'Attachment or flyer'],
  ].filter(([url], index, all) => url && all.findIndex(([candidate]) => candidate === url) === index);
  if (!links.length) return null;
  return <div className="review-source-links" aria-label="Submission sources and attachments">
    {links.map(([url, label]) => <a href={url} target="_blank" rel="noreferrer" key={label}>{label} ↗</a>)}
  </div>;
}

function displaySuggestion(value) {
  if (value == null) return 'No value extracted';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  try { return JSON.stringify(value); } catch { return 'Structured value'; }
}

function IntakeIdentity({ item, evidence }) {
  if (!evidence || !item?.date) return null;
  return <div className="review-identity-grid">
    <section><strong>Submitted by</strong><span>{item.submitted_by?.full_name || 'Name not provided'}</span><small>{item.submitted_by?.email || 'Email not provided'}</small><small>{evidence.relationshipLabel}</small></section>
    <section><strong>Event organizer</strong><span>{evidence.organizer?.organization || item.org || 'Hosting organization not provided'}</span><small>{evidence.organizer?.name || item.contact_name || 'Official contact name not provided'}</small><small>{evidence.organizer?.email || item.contact_email || 'Official contact email not provided'}</small></section>
  </div>;
}

function IntakeEvidence({ evidence, item }) {
  if (!evidence) return null;
  return <details className="review-details review-evidence">
    <summary>Submission details &amp; source</summary>
    <p className="review-private-note"><strong>Review before deciding.</strong> Compare the submitted details with the original source. These private links are never shown on public content pages.</p>
    <IntakeIdentity item={item} evidence={evidence} />
    {!item?.date && <div className="review-key-meta"><span>Source relationship: {evidence.relationshipLabel}</span></div>}
    {evidence.artifacts?.length ? <div className="review-evidence-group"><strong>Original source</strong><ul>{evidence.artifacts.map((artifact) => <li key={artifact.id}>
      {artifact.signedUrl ? <a href={artifact.signedUrl} target="_blank" rel="noreferrer">View {artifact.displayName} ↗</a> : artifact.sourceText ? <details><summary>View {artifact.displayName}</summary><pre className="review-source-text">{artifact.sourceText}</pre></details> : <span>{artifact.displayName} — source unavailable</span>}
    </li>)}</ul></div> : <p>No private source attachment was recorded.</p>}
    {evidence.suggestions?.length ? <div className="review-evidence-group"><strong>Details to confirm</strong><ul>{evidence.suggestions.map((suggestion) => <li key={suggestion.id}>
      <span><strong>{suggestion.label}:</strong> {displaySuggestion(suggestion.value)}</span>
      <small>{suggestion.needsReview ? 'Needs careful verification against the source.' : 'Confirm against the source before deciding.'}</small>
    </li>)}</ul></div> : <p>No suggested values were recorded. Verify the submitted details directly against the source.</p>}
  </details>;
}

export default function ReviewQueue({ queue }) {
  const items = queue;
  const [visible, setVisible] = useState(Object.fromEntries(SECTIONS.map(([key]) => [key, PAGE_SIZE])));
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = activeReviewType(searchParams.get('reviewType') || 'all');
  const counts = useMemo(() => reviewQueueCounts(items), [items]);
  const total = counts.all;
  const shownSections = active === 'all' ? SECTIONS : SECTIONS.filter(([key]) => key === active);
  const flatItems = Object.values(items).flat();
  const warningCount = flatItems.filter(item => ageDays(item.created_at)>=3&&ageDays(item.created_at)<5).length;
  const urgentCount = flatItems.filter(item => ageDays(item.created_at)>=5).length;
  const approachingCount = flatItems.filter(item => { const target=item.deadline||item.date; if(!target)return false; const days=Math.ceil((new Date(`${target}T23:59:59`).getTime()-Date.now())/864e5); return days>=0&&days<=7; }).length;

  function selectFilter(value) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') params.delete('reviewType');
    else params.set('reviewType', value);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return <><section className="review-priority-strip" aria-label="Review queue priorities"><div><span>Pending Review</span><strong>{total}</strong></div><div className="warning"><span>3–4 Days</span><strong>{warningCount}</strong></div><div className="urgent"><span>5+ Days</span><strong>{urgentCount}</strong></div><div><span>Deadline Approaching</span><strong>{approachingCount}</strong></div></section><div className="review-dashboard review-dashboard-operational">
    <div className="review-queue-column">
      <nav className="review-type-tabs" aria-label="Filter pending review items by content type">
        {FILTERS.map(([value, label]) => {
          const count = value === 'all' ? total : counts[value];
          return <button type="button" key={value} className={active === value ? 'active' : ''} aria-pressed={active === value} onClick={() => selectFilter(value)}>{label}<span aria-label={`${count} pending`}>{count}</span></button>;
        })}
      </nav>
      <p className="review-filter-status" role="status" aria-live="polite">Showing {active === 'all' ? 'all pending content' : `pending ${active}`}: {active === 'all' ? total : counts[active]} item{(active === 'all' ? total : counts[active]) === 1 ? '' : 's'}.</p>

      {!total && <div className="card review-empty" role="status">Nothing is waiting for review.</div>}
      {total > 0 && active !== 'all' && counts[active] === 0 && <div className="card review-empty" role="status"><h2>No pending {active}</h2><p>This queue is clear right now.</p><button type="button" className="chip" onClick={() => selectFilter('all')}>Back to all pending items</button></div>}

      {shownSections.map(([key, type, label]) => !items[key].length ? null : <section className="review-section" key={key} aria-labelledby={`review-${key}`}>
        <div className="section-title"><h2 id={`review-${key}`}>{label}</h2><span className="chip active">{items[key].length} waiting</span></div>
        <div className="review-card-list">{boundedReviewItems(items[key], visible[key]).map((item) => {
          const itemPriority=priority(item);
          const ownSubmission = Boolean(item.own_submission);
          return <article className={`card review-card priority-${itemPriority}`} key={item.id}>
            <div className="review-card-heading">
              <div>
                <div className="eyebrow">{item.type || type} · Submitted by {submitter(item)}</div>
                <h3>{item.title}</h3>
                <div className="review-card-age">Submitted {new Date(item.created_at).toLocaleString()} · Waiting {age(item.created_at)}</div>
              </div>
            <div className="review-card-actions" aria-label={`Review actions for ${item.title}`}>
                {ownSubmission
                  ? <span className="review-self-notice" role="status">Another reviewer must review this submission.</span>
                  : <Link href={`/admin/review/${type}/${item.id}`} className="gold-button">Review submission</Link>}
              </div>
            </div>
            <div className="review-key-meta">
              {item.date && <span>Event {new Date(`${item.date}T12:00:00`).toLocaleDateString()}</span>}
              {type === 'opportunity' && <span>{item.deadline ? `Deadline ${new Date(`${item.deadline}T12:00:00`).toLocaleDateString()}` : deadlineLabel(item.deadline_type, null, item.posted_date)}</span>}
              {item.location && <span>{item.location}</span>}
            </div>
            <SourceLinks item={item} />
            <IntakeEvidence evidence={item.intake_evidence} item={item} />
            {(item.description || item.body || item.eligibility || item.contact_name || item.contact_email) && <details className="review-details">
              <summary>View details</summary>
              {(item.description || item.body) && <p>{item.description || item.body}</p>}
              {item.eligibility && <p><strong>Eligibility:</strong> {item.eligibility}</p>}
              {(item.contact_name || item.contact_email) && <p><strong>Public contact:</strong> {[item.contact_name, item.contact_email].filter(Boolean).join(' · ')}</p>}
              {item.contact_title && <p><strong>Contact title:</strong> {item.contact_title}</p>}
              {!item.contact_name && !item.contact_email && <p><strong>Public contact:</strong> Not provided</p>}
            </details>}
          </article>;
        })}</div>
        {visible[key] < items[key].length && <button type="button" className="review-show-more" onClick={() => setVisible((previous) => ({ ...previous, [key]: previous[key] + PAGE_SIZE }))}>Show {Math.min(PAGE_SIZE, items[key].length - visible[key])} more {label.toLowerCase()} <span>({items[key].length - visible[key]} remaining)</span></button>}
      </section>)}
    </div>
  </div></>;
}
