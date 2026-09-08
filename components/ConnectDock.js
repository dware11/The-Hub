'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const HIDDEN_ROUTES = ['/about', '/admin', '/auth', '/submit', '/panther-submit'];

export default function ConnectDock() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const hidden = HIDDEN_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  useEffect(() => {
    setOpen(sessionStorage.getItem('code-connect-open') === 'true');
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  useEffect(() => {
    sessionStorage.setItem('code-connect-open', String(open));
  }, [open]);

  if (hidden) return null;

  return (
    <aside className={`connect-dock ${open ? 'is-open' : ''}`} aria-label="Connect with C.O.D.E.">
      <button
        type="button"
        className="connect-dock-toggle"
        aria-expanded={open}
        aria-controls="connect-dock-panel"
        onClick={() => setOpen((current) => !current)}
      >
        <ConnectIcon type={open ? 'close' : 'connect'} />
        <span>{open ? 'Minimize' : 'Connect with C.O.D.E.'}</span>
      </button>
      <div id="connect-dock-panel" className="connect-dock-panel" hidden={!open}>
        <div className="connect-dock-heading">
          <div><small>Council of Distinguished Engineers</small><strong>Stay connected</strong></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Minimize contact panel"><ConnectIcon type="close" /></button>
        </div>
        <a href="https://www.instagram.com/pvamucode/" target="_blank" rel="noreferrer"><ConnectIcon type="instagram" /><span><strong>Instagram</strong><small>@pvamucode</small></span></a>
        <a href="mailto:code@pvamu.edu"><ConnectIcon type="email" /><span><strong>Email C.O.D.E.</strong><small>code@pvamu.edu</small></span></a>
        <div className="connect-dock-coming" aria-disabled="true"><ConnectIcon type="linkedin" /><span><strong>LinkedIn</strong><small>Coming soon</small></span></div>
      </div>
      <span className="sr-only" role="status" aria-live="polite">Contact panel {open ? 'expanded' : 'minimized'}.</span>
    </aside>
  );
}

function ConnectIcon({ type }) {
  if (type === 'instagram') return <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" className="icon-fill" /></svg>;
  if (type === 'email') return <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>;
  if (type === 'linkedin') return <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M8 10v7M8 7v.2M12 17v-4a3 3 0 0 1 6 0v4M12 10v7" /></svg>;
  if (type === 'close') return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 7 10 10M17 7 7 17" /></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 5h14v11H9l-4 3V5Z" /><path d="M9 9h6M9 12h4" /></svg>;
}
