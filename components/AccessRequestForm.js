'use client';

import { useState } from 'react';
import { requestContributorAccess } from '../app/access/actions';

const REPRESENTATIONS = [['student_organization', 'Student organization'], ['department', 'Department'], ['faculty_staff', 'Faculty/staff'], ['sponsor_company', 'Sponsor company'], ['alumni', 'Alumni'], ['external_organization', 'External organization']];
const TARGET_LABELS = { general: 'General Hub content', opportunity: 'Opportunities', event: 'Events', announcement: 'Announcements' };

function PendingRequest({ request, onEdit }) {
  const submitted = new Date(request.updated_at || request.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return <section className="access-pending-card" aria-labelledby="access-pending-title">
    <span aria-hidden="true">✓</span>
    <div><div className="eyebrow">Request received</div><h2 id="access-pending-title">Contributor access request pending</h2><p>Your request was submitted for review. You’ll be able to submit Hub content after it is approved.</p>
      <dl><div><dt>Organization / department</dt><dd>{request.organization_department}</dd></div><div><dt>Representation</dt><dd>{REPRESENTATIONS.find(([value]) => value === request.representation_type)?.[1] || request.representation_type}</dd></div><div><dt>Requested submission area</dt><dd>{TARGET_LABELS[request.request_target] || 'General Hub content'}</dd></div><div><dt>Submitted</dt><dd>{submitted}</dd></div></dl>
      <button type="button" className="outline-button" onClick={onEdit}>Update request details</button>
    </div>
  </section>;
}

export default function AccessRequestForm({ viewer, target = 'general', existingRequest = null }) {
  const [pending, setPending] = useState(existingRequest);
  const [editing, setEditing] = useState(!existingRequest);
  const [form, setForm] = useState({ name: existingRequest?.name || '', organization: existingRequest?.organization_department || '', representationType: existingRequest?.representation_type || 'student_organization', pvamuContactName: '', pvamuContactEmail: '', intent: existingRequest?.access_intent || 'one_time', reason: '', target: existingRequest?.request_target || target });
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const external = !String(viewer.user?.email || '').toLowerCase().endsWith('@pvamu.edu') || ['sponsor_company', 'alumni', 'external_organization'].includes(form.representationType);
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setStatus('');
    const result = await requestContributorAccess(form);
    if (result.ok) {
      setPending(result.data || { ...existingRequest, name: form.name, organization_department: form.organization, representation_type: form.representationType, access_intent: form.intent, request_target: form.target, updated_at: new Date().toISOString() });
      setEditing(false);
    } else setStatus(result.error || 'Request could not be submitted.');
    setBusy(false);
  }

  if (pending && !editing) return <PendingRequest request={pending} onEdit={() => setEditing(true)} />;

  return <form className="access-request-form" onSubmit={submit}>
    <div><div className="eyebrow">Manual approval</div><h2>Request Contributor Access</h2><p>Signed in as <strong>{viewer.user?.email}</strong>. Your Auth account confirms your email; it does not grant a Hub role.</p></div>
    <label>Name<input required autoComplete="name" value={form.name} onChange={event => set('name', event.target.value)} /></label>
    <label>Organization / department<input required value={form.organization} onChange={event => set('organization', event.target.value)} /></label>
    <label>Representation type<select value={form.representationType} onChange={event => set('representationType', event.target.value)}>{REPRESENTATIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    {external && <div className="access-contact-grid"><label>PVAMU contact name<input required value={form.pvamuContactName} onChange={event => set('pvamuContactName', event.target.value)} /></label><label>PVAMU contact email<input required type="email" value={form.pvamuContactEmail} onChange={event => set('pvamuContactEmail', event.target.value)} /></label></div>}
    <label>Submission intent<select value={form.intent} onChange={event => set('intent', event.target.value)}><option value="one_time">One-time submission</option><option value="recurring">Recurring contributor</option></select></label>
    <label>Requested submission area<select value={form.target} onChange={event => set('target', event.target.value)}><option value="general">General Hub content</option><option value="opportunity">Opportunities</option><option value="event">Events</option><option value="announcement">Announcements</option></select><small>This helps reviewers understand what you plan to submit. It does not change your permissions.</small></label>
    <label>Reason / context<textarea required minLength={10} maxLength={1000} rows={5} value={form.reason} onChange={event => set('reason', event.target.value)} /></label>
    <div className="access-form-actions">{pending && <button type="button" className="outline-button" onClick={() => setEditing(false)}>Cancel</button>}<button className="gold-button" disabled={busy}>{busy ? 'Submitting…' : pending ? 'Update request' : 'Request contributor access'}</button></div>
    {status && <p role="status" aria-live="polite">{status}</p>}
  </form>;
}
