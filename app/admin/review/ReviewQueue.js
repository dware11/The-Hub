'use client';

import { useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { approveItem, rejectItem, requestCorrection } from './actions';
import { activeReviewType, boundedReviewItems, reviewQueueCounts } from '../../../lib/reviewQueue';

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

function IntakeEvidence({ evidence }) {
  if (!evidence) return null;
  return <details className="review-details review-evidence">
    <summary>Private source evidence &amp; extraction</summary>
    <p className="review-private-note"><strong>Reviewer only.</strong> Private file links expire after 10 minutes and are never shown on public content pages.</p>
    <div className="review-key-meta"><span>Source relationship: {(evidence.relationship_to_source || 'not recorded').replaceAll('_', ' ')}</span><span>Intake state: {evidence.state || 'submitted'}</span></div>
    {evidence.artifacts?.length ? <div className="review-evidence-group"><strong>Source attachments</strong><ul>{evidence.artifacts.map((artifact) => <li key={artifact.id}>
      {artifact.signed_url ? <a href={artifact.signed_url} target="_blank" rel="noreferrer">{artifact.original_filename || artifact.source_type || 'Private source'} ↗</a> : <span>{artifact.original_filename || artifact.source_type || 'Private source'} — secure link unavailable</span>}
      <small>{artifact.source_type} · {artifact.processing_status}</small>
    </li>)}</ul></div> : <p>No private source attachment was recorded.</p>}
    {evidence.suggestions?.length ? <div className="review-evidence-group"><strong>Parser provenance</strong><ul>{evidence.suggestions.map((suggestion) => <li key={suggestion.id}>
      <span><strong>{suggestion.field_name}:</strong> {displaySuggestion(suggestion.suggested_value)}</span>
      <small>{suggestion.provider} · {suggestion.parser_version}{Number.isFinite(suggestion.confidence) ? ` · ${suggestion.confidence}% confidence` : ' · confidence unavailable'}{suggestion.needs_review ? ' · reviewer confirmation requested' : ''}</small>
      {suggestion.review_reason && <small>{suggestion.review_reason}</small>}
    </li>)}</ul></div> : <p>No parser suggestions were recorded for this intake.</p>}
  </details>;
}

export default function ReviewQueue({ queue }) {
  const [items, setItems] = useState(queue);
  const [pendingId, setPendingId] = useState(null);
  const [message, setMessage] = useState('');
  const [checklist, setChecklist] = useState({});
  const [reviewItem, setReviewItem] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [visible, setVisible] = useState(Object.fromEntries(SECTIONS.map(([key]) => [key, PAGE_SIZE])));
  const [busy, startTransition] = useTransition();
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

  function decide(type, key, item, action) {
    if (action === 'approve' && !Object.values(checklist[item.id] || {}).every(Boolean)) { setMessage(`${item.title} cannot be approved until every review checklist item is confirmed.`); return; }
    setPendingId(item.id);
    setMessage(`${action === 'approve' ? 'Approving' : 'Rejecting'} ${item.title}.`);
    startTransition(async () => {
      const currentChecklist = checklist[item.id] || {};
      const evidence = { official_source_opened: Boolean(currentChecklist.source), primary_link_checked: Boolean(currentChecklist.facts), essential_facts_verified: Boolean(currentChecklist.facts), contact_organization_verified: Boolean(currentChecklist.contact), safe_content_confirmed: Boolean(currentChecklist.safe), reviewer_notes: reviewNote };
      const result = action === 'approve' ? await approveItem(type, item.id, evidence) : await rejectItem(type, item.id, reviewNote, evidence);
      if (result.ok) {
        setItems((previous) => ({ ...previous, [key]: previous[key].filter((candidate) => candidate.id !== item.id) }));
        setMessage(`${item.title} was ${action === 'approve' ? 'approved and published' : 'rejected'}.`);
      } else {
        setMessage(`${item.title} could not be updated. ${result.error || 'Try again.'}`);
      }
      setPendingId(null);
    });
  }

  return <><section className="review-priority-strip" aria-label="Review queue priorities"><div><span>Pending Review</span><strong>{total}</strong></div><div className="warning"><span>3–4 Days</span><strong>{warningCount}</strong></div><div className="urgent"><span>5+ Days</span><strong>{urgentCount}</strong></div><div><span>Deadline Approaching</span><strong>{approachingCount}</strong></div></section><div className="review-dashboard review-dashboard-operational">
    <div className="review-queue-column">
      <p className="sr-only" role="status" aria-live="polite">{message}</p>
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
          const working = busy && pendingId === item.id;
          const itemPriority=priority(item);
          return <article className={`card review-card priority-${itemPriority}`} key={item.id}>
            <div className="review-card-heading">
              <div>
                <div className="eyebrow">{item.type || type} · Submitted by {submitter(item)}</div>
                <h3>{item.title}</h3>
                <div className="review-card-age">Submitted {new Date(item.created_at).toLocaleString()} · Waiting {age(item.created_at)}</div>
              </div>
            <div className="review-card-actions" aria-label={`Review actions for ${item.title}`}>
                <button disabled={working} onClick={() => { setReviewItem({ type, key, item }); setReviewNote(''); }} className="chip">Reject</button>
                <button disabled={working} onClick={() => { setReviewItem({ type, key, item }); setReviewNote(''); }} className="gold-button">Review checklist</button>
              </div>
            </div>
            <div className="review-key-meta">
              {item.date && <span>Event {new Date(`${item.date}T12:00:00`).toLocaleDateString()}</span>}
              {item.deadline && <span>Deadline {new Date(`${item.deadline}T12:00:00`).toLocaleDateString()}</span>}
              {item.location && <span>{item.location}</span>}
            </div>
            <SourceLinks item={item} />
            <IntakeEvidence evidence={item.intake_evidence} />
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
    {reviewItem && <dialog open className="review-dialog" aria-labelledby="review-dialog-title" onKeyDown={e=>{if(e.key==='Escape')setReviewItem(null)}}><div className="review-dialog-card"><button className="review-dialog-close" aria-label="Close review checklist" onClick={()=>setReviewItem(null)}>×</button><h2 id="review-dialog-title">Verify &amp; decide</h2><p>Complete each confirmation before approving. The Hub does not automatically verify source links.</p>{[['source','Official source opened'],['facts','Title, date/deadline, location, and eligibility facts match the source'],['contact','Contact, organization, and submitted-by distinctions make sense'],['safe','Content is safe and appropriate']].map(([key,label])=><label key={key}><input type="checkbox" checked={Boolean(checklist[reviewItem.item.id]?.[key])} onChange={e=>setChecklist({...checklist,[reviewItem.item.id]:{...(checklist[reviewItem.item.id]||{}),[key]:e.target.checked}})} /> {label}</label>)}<label>Needs correction / review note<textarea rows="3" value={reviewNote} onChange={e=>setReviewNote(e.target.value)} placeholder="Required for correction requests or rejection." /></label><div className="review-dialog-actions"><button className="chip" onClick={async()=>{if(!reviewNote.trim()){setMessage('Add a note before requesting correction.');return;}const result=await requestCorrection(reviewItem.type,reviewItem.item.id,reviewNote);setMessage(result.ok?'Correction request recorded and audited.':result.error||'Correction request failed.');setReviewItem(null)}}>Needs correction</button><button className="chip" onClick={()=>{decide(reviewItem.type,reviewItem.key,reviewItem.item,'reject');setReviewItem(null)}}>Reject</button><button className="gold-button" onClick={()=>{decide(reviewItem.type,reviewItem.key,reviewItem.item,'approve');setReviewItem(null)}}>Approve &amp; publish</button></div></div></dialog>}
  </div></>;
}
