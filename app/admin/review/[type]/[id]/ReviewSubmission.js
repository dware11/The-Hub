'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { approveItem, rejectItem, requestCorrection, reviewStaleApplyAsap } from '../../actions';
import { REVIEW_CHECKS, emptyReviewChecklist, isReviewChecklistComplete, reviewEvidence } from '../../../../../lib/reviewChecklist';
import { deadlineLabel } from '../../../../../lib/opportunityOptions';

function displaySuggestion(value) {
  if (value == null || value === '') return 'No value extracted';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  try { return JSON.stringify(value); } catch { return 'Structured value'; }
}

export default function ReviewSubmission({ item, type, ownSubmission = false }) {
  const [checklist,setChecklist] = useState(emptyReviewChecklist);
  const [note,setNote] = useState('');
  const [message,setMessage] = useState('');
  const [rejecting,setRejecting] = useState(false);
  const [rejectReason,setRejectReason] = useState('');
  const [busy,startTransition] = useTransition();
  const router = useRouter();
  const complete = isReviewChecklistComplete(checklist);
  const intake = item.intake_evidence;
  const relationship = intake?.relationshipLabel || 'Not recorded';

  function decide(action) {
    if (ownSubmission) { setMessage('Another reviewer must review this submission.'); return; }
    if (!complete) { setMessage('Complete every review checklist item before making a final decision.'); return; }
    const decisionNote = action === 'reject' ? rejectReason : note;
    if ((action === 'reject' || action === 'correction') && !decisionNote.trim()) { setMessage(`Add a reason before ${action === 'reject' ? 'rejecting' : 'requesting a correction'}.`); return; }
    setMessage('Saving review decision…');
    startTransition(async () => {
      try {
        const result = action === 'approve'
          ? await approveItem(type,item.id,reviewEvidence(checklist,note))
          : action === 'reject'
            ? await rejectItem(type,item.id,decisionNote,reviewEvidence(checklist,decisionNote))
            : await requestCorrection(type,item.id,note,reviewEvidence(checklist,note));
        if (!result?.ok) { setMessage(result?.error || 'The review decision could not be saved.'); return; }
        const deliveryNote = result.notification?.ok === false ? ' The decision was saved, but the contributor email could not be delivered; the failure was logged.' : '';
        setMessage((action === 'approve' ? 'Approved and published.' : action === 'reject' ? 'Rejected.' : 'Correction requested.') + deliveryNote + ' Returning to the Review Queue…');
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
      <section className="review-section-block review-source-block" aria-labelledby="review-source-title"><div className="eyebrow" id="review-source-title">Start with the source</div><h3>Open the original information first</h3><p className="review-private-note">Use the source to verify everything shown on this page. Private attachments are available only to reviewers.</p><div className="review-primary-source-actions">{item.source_url&&<a className="gold-button inline-flex" href={item.source_url} target="_blank" rel="noreferrer">Open official source ↗</a>}{(item.link||item.registration_link)&&(!item.source_url||(item.link||item.registration_link)!==item.source_url)&&<a className="outline-button inline-flex" href={item.link||item.registration_link} target="_blank" rel="noreferrer">Open application ↗</a>}</div>{intake?.artifacts?.length ? <ul className="review-source-list">{intake.artifacts.map((artifact) => <li key={artifact.id}><span>{artifact.displayName}</span>{artifact.signedUrl ? <a href={artifact.signedUrl} target="_blank" rel="noreferrer">View original source ↗</a> : artifact.sourceText ? <details><summary>View submitted text</summary><pre className="review-source-text">{artifact.sourceText}</pre></details> : <small>Original source is unavailable.</small>}</li>)}</ul> : <p>No private attachment or pasted source text was included.</p>}</section>
      <section className="review-section-block" aria-labelledby="review-submitter-title"><div className="eyebrow" id="review-submitter-title">Submitted by</div><div className="review-identity-grid"><section><strong>Submitter</strong><span>{item.submitted_by?.full_name||'Name not provided'}</span><small>{item.submitted_by?.email||'Email not provided'}</small><small>{relationship}</small></section><section><strong>Submitter context</strong><span>{intake?.submitterContext?.affiliation||item.submitted_by?.org||'Affiliation not provided'}</span><small>{intake?.submitterContext?.role||'Role not provided'}</small><small>{intake?.submitterContext?.relationship||'Relationship details not provided'}</small></section></div></section>
      <section className="review-section-block" aria-labelledby="review-organizer-title"><div className="eyebrow" id="review-organizer-title">{type === 'announcement' ? 'Source organization' : type === 'event' ? 'Event organizer' : 'Hosting organization'}</div><dl><dt>Organization</dt><dd>{intake?.organizer?.organization||item.org||item.source||'Not provided'}</dd><dt>Contact</dt><dd>{[intake?.organizer?.name||item.contact_name,intake?.organizer?.email||item.contact_email].filter(Boolean).join(' · ')||'Not provided'}</dd></dl></section>
      <section className="review-section-block" aria-labelledby="review-suggestions-title"><div className="eyebrow" id="review-suggestions-title">Details to confirm</div>{intake?.suggestions?.length ? <dl className="review-suggestion-list">{intake.suggestions.map((suggestion)=><div key={suggestion.id}><dt>{suggestion.label}</dt><dd>{displaySuggestion(suggestion.value)}{suggestion.needsReview&&<small>Compare this value with the original source.</small>}</dd></div>)}</dl> : <p>No extracted details were recorded. Verify the submitted information directly against the source.</p>}</section>
    </div>
<section className="review-submission-controls" aria-labelledby="review-checklist-title"><div className="eyebrow">Reviewer checklist</div><h2 id="review-checklist-title">Review one step at a time</h2>{ownSubmission ? <div className="review-self-notice review-self-notice-block" role="status">Another reviewer must review this submission.</div> : <><p className="review-checklist-intro">Check each item only after comparing the submission with its source. All steps are required before a final decision.</p><p className="review-decision-guidance"><strong>Request Correction</strong> for fixable issues such as a typo, missing field, unclear description, or incomplete contact information. <strong>Reject</strong> only when the submission cannot appropriately proceed.</p></>}{item.availability_review_due&&<div className="review-availability-warning"><strong>Availability Check</strong><p>This Apply ASAP submission has waited about 30 days. Open the source and confirm it is still accepting applications.</p><div><button type="button" className="outline-button" disabled={busy||ownSubmission} onClick={()=>startTransition(async()=>{const result=await reviewStaleApplyAsap(item.id,'continue_review');setMessage(result.ok?'Availability confirmed. Continue the review below.':result.error);})}>Continue Review</button><button type="button" className="chip" disabled={busy||ownSubmission} onClick={()=>startTransition(async()=>{const result=await reviewStaleApplyAsap(item.id,'mark_closed');if(result.ok){router.replace('/admin/review');router.refresh();}else setMessage(result.error);})}>Mark Closed</button></div></div>}<fieldset className="review-checklist-fieldset" disabled={busy||ownSubmission}><legend className="sr-only">Required review confirmations</legend><div className="review-checklist-steps">{REVIEW_CHECKS.map(([key,label,help],index)=><label className="review-checklist-step" key={key}><span className="review-step-number" aria-hidden="true">{index+1}</span><input type="checkbox" checked={checklist[key]} onChange={(event)=>setChecklist((current)=>({...current,[key]:event.target.checked}))}/><span><strong>{label}</strong><small>{help}</small></span></label>)}</div><label className="review-note-label">Correction note<textarea rows="5" value={note} onChange={(event)=>setNote(event.target.value)} placeholder="Required when requesting a correction. Explain exactly what needs to change."/></label></fieldset><p className="workspace-status" role={message && !busy ? 'alert' : 'status'} aria-live="assertive">{message}</p><div className="review-submission-actions"><button type="button" className="gold-button" disabled={busy||ownSubmission||!complete} onClick={()=>decide('approve')}>{busy ? 'Saving decision…' : 'Approve & Publish'}</button><button type="button" className="chip" disabled={busy||ownSubmission||!complete} onClick={()=>decide('correction')}>{busy ? 'Saving…' : 'Request Correction'}</button><button type="button" className="chip" disabled={busy||ownSubmission||!complete} onClick={()=>setRejecting(true)}>{busy ? 'Saving…' : 'Reject'}</button></div></section>
    {rejecting&&<div className="review-decision-backdrop"><div role="dialog" aria-modal="true" aria-labelledby="reject-title" className="review-decision-dialog"><h2 id="reject-title">Reject this submission?</h2><p>Use Reject when the source is invalid, unverifiable, mismatched, spam or fraud, inappropriate or irrelevant, or fundamentally unsuitable for the Hub.</p><p>If the contributor can fix the issue, use Request Correction instead.</p><label>Reason <span aria-hidden="true">*</span><span className="sr-only"> (required)</span><textarea rows="5" required value={rejectReason} onChange={(event)=>setRejectReason(event.target.value)} placeholder="Explain why this submission cannot proceed."/></label><div><button type="button" className="outline-button" disabled={busy} onClick={()=>setRejecting(false)}>Cancel</button><button type="button" className="danger-button" disabled={busy||!rejectReason.trim()} onClick={()=>decide('reject')}>{busy?'Rejecting…':'Confirm Reject'}</button></div></div></div>}
  </div>;
}
