'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { approveItem, rejectItem, requestCorrection } from '../../actions';
import { REVIEW_CHECKS, emptyReviewChecklist, isReviewChecklistComplete, reviewEvidence } from '../../../../../lib/reviewChecklist';
import { deadlineLabel } from '../../../../../lib/opportunityOptions';

function displaySuggestion(value) {
  if (value == null || value === '') return 'No value extracted';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  try { return JSON.stringify(value); } catch { return 'Structured value'; }
}

export default function ReviewSubmission({ item, type, showTechnical = false }) {
  const [checklist,setChecklist] = useState(emptyReviewChecklist);
  const [note,setNote] = useState('');
  const [message,setMessage] = useState('');
  const [busy,startTransition] = useTransition();
  const router = useRouter();
  const complete = isReviewChecklistComplete(checklist);
  const intake = item.intake_evidence;
  const relationship = intake?.relationshipLabel || 'Not recorded';

  function decide(action) {
    if (!complete) { setMessage('Complete every review checklist item before making a final decision.'); return; }
    if ((action === 'reject' || action === 'correction') && !note.trim()) { setMessage(`Add a reason before ${action === 'reject' ? 'rejecting' : 'requesting a correction'}.`); return; }
    setMessage('Saving review decision…');
    startTransition(async () => {
      try {
        const result = action === 'approve'
          ? await approveItem(type,item.id,reviewEvidence(checklist,note))
          : action === 'reject'
            ? await rejectItem(type,item.id,note,reviewEvidence(checklist,note))
            : await requestCorrection(type,item.id,note,reviewEvidence(checklist,note));
        if (!result?.ok) { setMessage(result?.error || 'The review decision could not be saved.'); return; }
        setMessage(action === 'approve' ? 'Approved and published. Returning to the Review Queue…' : action === 'reject' ? 'Rejected. Returning to the Review Queue…' : 'Correction requested. Returning to the Review Queue…');
        router.replace('/admin/review');
        router.refresh();
      } catch (error) {
        setMessage(error?.message || 'The review decision could not be saved. Please try again.');
      }
    });
  }

  return <div className="review-submission-layout">
    <div className="review-submission-source">
      <section aria-labelledby="review-submission-title"><div className="eyebrow">Submission</div><h2 id="review-submission-title">{item.title}</h2><dl>{item.description&&<><dt>Description</dt><dd>{item.description}</dd></>}{item.body&&<><dt>Announcement</dt><dd>{item.body}</dd></>}{item.date&&<><dt>Date</dt><dd>{item.date}{item.time?` · ${item.time}`:''}</dd></>}{type === 'opportunity'&&<><dt>Deadline</dt><dd>{item.deadline || deadlineLabel(item.deadline_type, null, item.posted_date)}</dd></>}{item.location&&<><dt>Location</dt><dd>{item.location}</dd></>}{item.eligibility&&<><dt>Eligibility</dt><dd>{item.eligibility}</dd></>}</dl></section>
      <section className="review-section-block" aria-labelledby="review-source-title"><div className="eyebrow" id="review-source-title">Submission details &amp; source</div><p className="review-private-note"><strong>Review before deciding.</strong> Compare the submitted details with the original source.</p>{intake?.artifacts?.length ? <ul className="review-source-list">{intake.artifacts.map((artifact) => <li key={artifact.id}><span>{artifact.displayName}</span>{artifact.signedUrl ? <a href={artifact.signedUrl} target="_blank" rel="noreferrer">View original source ↗</a> : artifact.sourceText ? <details><summary>View submitted text</summary><pre className="review-source-text">{artifact.sourceText}</pre></details> : <small>Original source is unavailable.</small>}</li>)}</ul> : <p>No original source was recorded.</p>}{item.source_url&&<a className="outline-button inline-flex mt-3" href={item.source_url} target="_blank" rel="noreferrer">Open official source ↗</a>}</section>
      <section className="review-section-block" aria-labelledby="review-submitter-title"><div className="eyebrow" id="review-submitter-title">Submitted by</div><div className="review-identity-grid"><section><strong>Submitter</strong><span>{item.submitted_by?.full_name||'Name not provided'}</span><small>{item.submitted_by?.email||'Email not provided'}</small><small>{relationship}</small></section><section><strong>Submitter context</strong><span>{intake?.submitterContext?.affiliation||item.submitted_by?.org||'Affiliation not provided'}</span><small>{intake?.submitterContext?.role||'Role not provided'}</small><small>{intake?.submitterContext?.relationship||'Relationship details not provided'}</small></section></div></section>
      <section className="review-section-block" aria-labelledby="review-organizer-title"><div className="eyebrow" id="review-organizer-title">Event organizer / hosting organization</div><dl><dt>Organization</dt><dd>{intake?.organizer?.organization||item.org||item.source||'Not provided'}</dd><dt>Contact</dt><dd>{[intake?.organizer?.name||item.contact_name,intake?.organizer?.email||item.contact_email].filter(Boolean).join(' · ')||'Not provided'}</dd></dl></section>
      <section className="review-section-block" aria-labelledby="review-suggestions-title"><div className="eyebrow" id="review-suggestions-title">Details to confirm</div>{intake?.suggestions?.length ? <dl className="review-suggestion-list">{intake.suggestions.map((suggestion)=><div key={suggestion.id}><dt>{suggestion.label}</dt><dd>{displaySuggestion(suggestion.value)}{suggestion.needsReview&&<small>Compare this value with the original source.</small>}</dd></div>)}</dl> : <p>No extracted details were recorded. Verify the submitted information directly against the source.</p>}</section>
      {showTechnical && intake?.diagnostics && <details className="review-details"><summary>Technical diagnostics</summary><div className="review-key-meta"><span>Content ID: {item.id}</span><span>Review state: {item.status}</span><span>Intake state: {intake.diagnostics.intakeState||'not recorded'}</span><span>Acknowledgment: {intake.diagnostics.acknowledgment?'accepted':'not recorded'}</span></div>{intake.diagnostics.artifacts?.length?<ul>{intake.diagnostics.artifacts.map((artifact)=><li key={artifact.id}>{artifact.sourceType||'unknown source'}: {artifact.processingStatus||'status unavailable'}{artifact.mimeType?` · ${artifact.mimeType}`:''}</li>)}</ul>:null}{intake.diagnostics.suggestions?.length ? <ul>{intake.diagnostics.suggestions.map((suggestion) => <li key={suggestion.id}><strong>{suggestion.fieldName}</strong>: {suggestion.provider || 'provider unavailable'} / {suggestion.parserVersion || 'parser unavailable'}{Number.isFinite(suggestion.confidence)?` / ${suggestion.confidence}% confidence`:''}{suggestion.reviewReason?` · ${suggestion.reviewReason}`:''}</li>)}</ul> : <p>No extraction details were recorded.</p>}</details>}
    </div>
    <section className="review-submission-controls" aria-labelledby="review-checklist-title"><div className="eyebrow">Review checklist</div><h2 id="review-checklist-title">Confirm before deciding</h2>{REVIEW_CHECKS.map(([key,label])=><label key={key}><input type="checkbox" checked={checklist[key]} onChange={(event)=>setChecklist((current)=>({...current,[key]:event.target.checked}))}/> {label}</label>)}<label className="review-note-label">Reviewer note<textarea rows="5" value={note} onChange={(event)=>setNote(event.target.value)} placeholder="Required when requesting a correction or rejecting."/></label><p className="workspace-status" role="status" aria-live="assertive">{message}</p><div className="review-submission-actions"><button type="button" className="gold-button" disabled={busy||!complete} onClick={()=>decide('approve')}>Approve &amp; Publish</button><button type="button" className="chip" disabled={busy||!complete} onClick={()=>decide('correction')}>Request Correction</button><button type="button" className="chip" disabled={busy||!complete} onClick={()=>decide('reject')}>Reject</button></div></section>
  </div>;
}
