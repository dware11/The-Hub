'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createIssueReport } from '../app/report/actions';
import { CONTENT_ISSUES, SITE_ISSUES } from '../lib/issueTypes';

export default function ReportIssueForm({ contentType = null, contentId = null, contentTitle = '', defaultIssueType = '', label = 'Report a problem' }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef(null);
  const issues = contentType ? CONTENT_ISSUES : SITE_ISSUES;

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
        pageUrl: pathname,
      });
      if (result.ok) {
        formElement.reset();
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
      <label>Issue type<select name="issue_type" required defaultValue={issues.includes(defaultIssueType) ? defaultIssueType : ''}><option value="" disabled>Select one</option>{issues.map(issue => <option key={issue}>{issue}</option>)}</select></label>
      <label>Description<textarea name="description" required maxLength={3000} rows={3} /></label>
      <label>Your email <span>(optional)</span><input name="reporter_email" type="email" autoComplete="email" /></label>
      <button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send report'}</button>
      {status && <p role="status" aria-live="polite">{status}</p>}
    </form></div></div>}
  </div>;
}
