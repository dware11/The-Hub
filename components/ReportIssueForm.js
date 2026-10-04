'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createIssueReport } from '../app/report/actions';
import { SITE_ISSUES, issuesForContentType } from '../lib/issueTypes';
import { ORGANIZATION_TYPES } from '../lib/organizationTypes';

export default function ReportIssueForm({ contentType = null, contentId = null, contentTitle = '', defaultIssueType = '', defaultReporterEmail = '', label = 'Report a problem', organizationRequest = false }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef(null);
  const issues = contentType ? issuesForContentType(contentType) : SITE_ISSUES;
  const initialIssueType = organizationRequest ? 'Organization addition request' : issues.includes(defaultIssueType) ? defaultIssueType : '';
  const [issueType, setIssueType] = useState(initialIssueType);
  const isOrganizationRequest = organizationRequest || issueType === 'Organization addition request';

  useEffect(() => {
    setOpen(false);
    setStatus('');
    setBusy(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.querySelector('button, select, textarea, input')?.focus();
    const onKeyDown = event => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = [...dialog.querySelectorAll('button:not([disabled]), select, textarea, input, a[href]')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus?.(); };
  }, [open]);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const formElement = event.currentTarget;
    setBusy(true);
    setStatus('Sending…');
    try {
      const form = new FormData(formElement);
      const result = await createIssueReport({
        contentType,
        contentId,
        issueType: form.get('issue_type'),
        description: form.get('description'),
        reporterEmail: form.get('reporter_email'),
        organizationName: form.get('organization_name'),
        organizationType: form.get('organization_type'),
        organizationContactName: form.get('organization_contact_name'),
        organizationContactEmail: form.get('organization_contact_email'),
        organizationWebsite: form.get('organization_website'),
        pageUrl: pathname,
      });
      if (result.ok) {
        formElement.reset();
        setIssueType(initialIssueType);
        setStatus(isOrganizationRequest ? 'Thank you. Your organization request was saved for Hub review.' : 'Thank you. Your report was saved for Hub review.');
      } else setStatus(result.error || 'The report could not be sent.');
    } catch {
      setStatus('The report could not be sent. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="issue-report">
    <button type="button" className="issue-report-toggle" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>{label}</button>
    {open && <div className="issue-report-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}><div ref={dialogRef} className="issue-report-dialog" role="dialog" aria-modal="true" aria-labelledby="issue-report-title"><form className="issue-report-form" onSubmit={submit}>
      <div className="issue-report-heading"><div><span>Hub support</span><h2 id="issue-report-title">{label}</h2>{contentTitle && <p>{contentTitle}</p>}</div><button type="button" className="issue-report-close" aria-label="Close report dialog" onClick={() => setOpen(false)}>×</button></div>
      {organizationRequest ? <input type="hidden" name="issue_type" value="Organization addition request" /> : <label>Issue type<select name="issue_type" required value={issueType} onChange={(event) => { setIssueType(event.target.value); setStatus(''); }}><option value="" disabled>Select one</option>{issues.map(issue => <option key={issue}>{issue}</option>)}</select></label>}
      {isOrganizationRequest ? <>
        <p className="organization-request-help">Send the organization to the Hub team for verification. It will not appear in Hub forms until an administrator approves it.</p>
        <div className="organization-request-grid">
          <label>Organization name<input name="organization_name" required maxLength={160} autoComplete="organization" /></label>
          <label>Organization type<select name="organization_type" required defaultValue=""><option value="" disabled>Select one</option>{ORGANIZATION_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
          <label>Organization contact name <span>(optional)</span><input name="organization_contact_name" maxLength={160} autoComplete="name" /></label>
          <label>Organization contact email <span>(optional)</span><input name="organization_contact_email" type="email" maxLength={320} autoComplete="email" /></label>
        </div>
        <label>Official website or page <span>(optional)</span><input name="organization_website" type="url" maxLength={2000} placeholder="https://" /></label>
        <label>Additional context <span>(optional)</span><textarea name="description" maxLength={3000} rows={4} placeholder="Anything the Hub team should know while verifying this organization." /></label>
        <p className="organization-request-requirement">Your signed-in account is recorded automatically with this request.</p>
      </> : <>
        <label>Description<textarea name="description" required maxLength={3000} rows={3} /></label>
        <label>Your email <span>(optional)</span><input name="reporter_email" type="email" autoComplete="email" /></label>
      </>}
      <button type="submit" disabled={busy}>{busy ? 'Sending…' : isOrganizationRequest ? 'Send organization request' : 'Send report'}</button>
      {status && <p role="status" aria-live="polite">{status}</p>}
    </form></div></div>}
  </div>;
}
