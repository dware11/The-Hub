'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createIssueReport } from '../app/report/actions';
import { CONTENT_ISSUES, SITE_ISSUES } from '../lib/issueTypes';

export default function ReportIssueForm({ contentType = null, contentId = null, contentTitle = '', defaultIssueType = '', defaultReporterEmail = '', label = 'Report a problem' }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef(null);
  const issues = contentType ? CONTENT_ISSUES : SITE_ISSUES;
  const initialIssueType = issues.includes(defaultIssueType) ? defaultIssueType : '';
  const [issueType, setIssueType] = useState(initialIssueType);
  const isOrganizationRequest = issueType === 'Organization addition request';

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
        organizationAbbreviation: form.get('organization_abbreviation'),
        organizationRelationship: form.get('organization_relationship'),
        organizationEmail: form.get('organization_email'),
        pageUrl: pathname,
      });
      if (result.ok) {
        formElement.reset();
        setIssueType(initialIssueType);
        setStatus('Thank you. Your report was saved for Hub review.');
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
      <label>Issue type<select name="issue_type" required value={issueType} onChange={(event) => { setIssueType(event.target.value); setStatus(''); }}><option value="" disabled>Select one</option>{issues.map(issue => <option key={issue}>{issue}</option>)}</select></label>
      {isOrganizationRequest ? <>
        <p className="organization-request-help">Requesting a student organization requires an identifiable PVAMU contact. The request is reviewed before the organization becomes available in Hub forms.</p>
        <div className="organization-request-grid">
          <label>Organization name<input name="organization_name" required maxLength={160} autoComplete="organization" /></label>
          <label>Abbreviation<input name="organization_abbreviation" required maxLength={24} placeholder="Example: C.O.D.E." /></label>
          <label>Your relationship to the organization<input name="organization_relationship" required maxLength={160} placeholder="President, officer, member, adviser" /></label>
          <label>Organization email<input name="organization_email" type="email" required maxLength={320} autoComplete="email" /></label>
        </div>
        <label>Your PVAMU email <span>(required for verification)</span><input name="reporter_email" type="email" required maxLength={320} autoComplete="email" defaultValue={defaultReporterEmail} pattern="^[A-Za-z0-9._%+-]+@pvamu[.]edu$" title="Use your @pvamu.edu email address." aria-describedby="organization-email-requirement" /></label>
        <p id="organization-email-requirement" className="organization-request-requirement">Use your current <strong>@pvamu.edu</strong> address. Personal Gmail, Outlook, and other addresses cannot verify an organization request.</p>
        <label>Additional details <span>(optional)</span><textarea name="description" maxLength={3000} rows={4} placeholder="Anything the Hub team should know while verifying this organization." /></label>
      </> : <>
        <label>Description<textarea name="description" required maxLength={3000} rows={3} /></label>
        <label>Your email <span>(optional)</span><input name="reporter_email" type="email" autoComplete="email" /></label>
      </>}
      <button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send report'}</button>
      {status && <p role="status" aria-live="polite">{status}</p>}
    </form></div></div>}
  </div>;
}
