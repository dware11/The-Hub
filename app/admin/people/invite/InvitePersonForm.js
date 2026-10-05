'use client';

import Link from 'next/link';
import { useState } from 'react';
import ReportIssueForm from '../../../../components/ReportIssueForm';
import { invitePerson } from '../actions';

const TYPES = [
  ['student_organization','Student Organization'],
  ['department','Department'],
  ['college','College'],
  ['university_office','University Office'],
  ['none','None'],
];

export default function InvitePersonForm({ organizations, reporterEmail }) {
  const [type,setType]=useState('student_organization');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [complete,setComplete]=useState(null);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage('Saving invitation and sending email…');
    const form=new FormData(event.currentTarget);
    const result=await invitePerson({
      email:form.get('email'), firstName:form.get('first_name'), lastName:form.get('last_name'), intendedRole:form.get('intended_role'), affiliationType:type,
      organizationId:type==='student_organization'?form.get('organization_id'):null,
      affiliationValue:['department','college','university_office'].includes(type)?form.get('affiliation_value'):null,
    });
    setBusy(false);
    if (!result.ok) { setMessage(result.error || 'The invitation could not be created.'); return; }
    setComplete({ email: String(form.get('email')), role: String(form.get('intended_role')) });
    setMessage(result.emailSent ? 'Invitation saved and email sent.' : result.warning || 'Invitation saved.');
  }

  return <section className="invite-person-card">
    <div className="invite-person-explainer"><strong>Hub access and affiliation are separate.</strong><span>Hub access controls what this person can do. Affiliation records who they represent.</span></div>
    {complete ? <div className="invite-success" role="status"><div><strong>Invitation sent</strong><p>{complete.email} was invited as {complete.role.charAt(0).toUpperCase()+complete.role.slice(1)}.<br/>They’ll receive an email with instructions to sign in to the Hub.</p></div><div><button className="chip" type="button" onClick={()=>setComplete(null)}>Invite Another</button><Link className="outline-button" href="/admin/people">Done</Link></div></div> : <form className="invite-person-form" onSubmit={submit}>
      <label className="invite-span-2">PVAMU Email <span aria-hidden="true">*</span><input name="email" type="email" required pattern="[^@\s]+@pvamu\.edu" placeholder="name@pvamu.edu" autoComplete="email" /></label>
      <label className="invite-span-2">First Name <span aria-hidden="true">*</span><input name="first_name" required maxLength={80} autoComplete="given-name" /></label>
      <label className="invite-span-2">Last Name <span aria-hidden="true">*</span><input name="last_name" required maxLength={80} autoComplete="family-name" /></label>
      <label className="invite-span-3">Initial Hub Access <span aria-hidden="true">*</span><select name="intended_role" required defaultValue="contributor" aria-describedby="access-help"><option value="contributor">Contributor</option><option value="reviewer">Reviewer</option><option value="admin">Admin</option></select><small id="access-help">Controls what this person can do after their first verified sign-in.</small></label>
      <label className="invite-span-3">Affiliation Type <span aria-hidden="true">*</span><select value={type} onChange={event=>setType(event.target.value)}>{TYPES.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select><small>Records who this person represents; it does not change Hub access.</small></label>
      {type==='student_organization' && <><label className="invite-span-3">Affiliation <span aria-hidden="true">*</span><select name="organization_id" required defaultValue=""><option value="" disabled>Select an approved organization</option>{organizations.map(org=><option value={org.id} key={org.id}>{org.name}</option>)}</select></label><div className="invite-affiliation-helper invite-span-3"><span>Organization not listed?</span><ReportIssueForm label="Can’t find your organization? Request it." organizationRequest defaultReporterEmail={reporterEmail} /></div></>}
      {type==='department' && <label className="invite-span-3">Department <span aria-hidden="true">*</span><input name="affiliation_value" required placeholder="Example: Computer Science" maxLength={240} /></label>}
      {type==='college' && <label className="invite-span-3">College <span aria-hidden="true">*</span><input name="affiliation_value" required defaultValue="Roy G. Perry College of Engineering" maxLength={240} /></label>}
      {type==='university_office' && <label className="invite-span-3">University Office <span aria-hidden="true">*</span><input name="affiliation_value" required placeholder="Enter the office name" maxLength={240} /></label>}
      {type==='none' && <><div className="invite-empty-affiliation" aria-hidden="true"/><p className="field-help">No affiliation will be attached to this person.</p></>}
      <div className="invite-person-actions"><Link className="outline-button" href="/admin/people">Cancel</Link><button className="gold-button" type="submit" disabled={busy}>{busy?'Sending…':'Send Invitation'}</button></div>
      {message && !complete && <p className="workspace-status" role="status" aria-live="polite">{message}</p>}
    </form>}
  </section>;
}
