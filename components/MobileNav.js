'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

function closeOnNavigate(setOpen) {
  return () => setOpen(false);
}

export default function MobileNav({ reviewer, admin, superAdmin }) {
  const [open, setOpen] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = event => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const closeMenu = closeOnNavigate(setOpen);
  return (
    <div className="mobile-nav">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? 'Close navigation' : 'Open navigation'}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? '×' : '☰'}
      </button>
      {open && (
        <div id="mobile-menu" className="mobile-menu">
          <Link href="/" aria-current={pathname === '/' ? 'page' : undefined} onClick={closeMenu}>Home</Link>
          <div className="mobile-nav-group">
            <button type="button" aria-expanded={discoverOpen} onClick={() => setDiscoverOpen(value => !value)}>Discover <span aria-hidden="true">{discoverOpen ? '−' : '+'}</span></button>
            {discoverOpen && <div>
              <Link href="/events" aria-current={pathname.startsWith('/events') ? 'page' : undefined} onClick={closeMenu}>Events</Link>
              <Link href="/opportunities" aria-current={pathname.startsWith('/opportunities') ? 'page' : undefined} onClick={closeMenu}>Opportunities</Link>
              <Link href="/announcements" aria-current={pathname.startsWith('/announcements') ? 'page' : undefined} onClick={closeMenu}>Announcements</Link>
            </div>}
          </div>
          <Link href="/about" onClick={closeMenu}>Who Is C.O.D.E.?</Link>
          {reviewer && <div className="mobile-nav-group">
            <div className="mobile-workspace-trigger">
              <Link href="/admin" aria-current={pathname === '/admin' ? 'page' : undefined} onClick={closeMenu}>Workspace</Link>
              <button type="button" aria-label="Toggle Workspace links" aria-expanded={workspaceOpen} onClick={() => setWorkspaceOpen(value => !value)}>{workspaceOpen ? '−' : '+'}</button>
            </div>
            {workspaceOpen && <div>
              <Link href="/admin/review" onClick={closeMenu}>Review Queue</Link>
              <Link href="/admin/committee" onClick={closeMenu}>Contributor Approvals</Link>
              {admin && <><Link href="/admin/content" onClick={closeMenu}>Content Management</Link><Link href="/admin/people" onClick={closeMenu}>People &amp; Access</Link></>}
              <Link href="/admin/analytics" onClick={closeMenu}>Analytics</Link>
              {superAdmin && <><Link href="/admin/history" onClick={closeMenu}>History</Link><Link href="/admin/system" onClick={closeMenu}>System Insights</Link></>}
            </div>}
          </div>}
        </div>
      )}
    </div>
  );
}
