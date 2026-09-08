'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

function MenuGroup({ label, children, href, menuLabel, active }) {
  const [open, setOpen] = useState(false);
  const [suppressHover, setSuppressHover] = useState(false);
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const returningFocusRef = useRef(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        returningFocusRef.current = true;
        setSuppressHover(true);
        setOpen(false);
        triggerRef.current?.focus();
        window.setTimeout(() => { returningFocusRef.current = false; }, 200);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const closeIfOutside = (event) => {
    if (!wrapperRef.current?.contains(event.relatedTarget)) setOpen(false);
  };

  return (
    <div
      ref={wrapperRef}
      className={`desktop-nav-group${suppressHover ? ' suppress-hover' : ''}`}
      onMouseEnter={() => { if (!suppressHover) setOpen(true); }}
      onMouseLeave={() => { setOpen(false); setSuppressHover(false); }}
      onFocus={() => { if (!returningFocusRef.current) setOpen(true); }}
      onBlur={closeIfOutside}
    >
      {href ? (
        <Link
          ref={triggerRef}
          href={href}
          className={`desktop-nav-trigger${active ? ' active' : ''}`}
          aria-current={active ? 'page' : undefined}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {label} <span className="nav-chevron" aria-hidden="true">⌄</span>
        </Link>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          className={`desktop-nav-trigger desktop-nav-trigger-button${active ? ' active' : ''}`}
          aria-current={active ? 'page' : undefined}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          {label} <span className="nav-chevron" aria-hidden="true">⌄</span>
        </button>
      )}
      <div className={`desktop-nav-menu${open ? ' is-open' : ''}`} role="menu" aria-label={menuLabel || label}>
        {children}
      </div>
    </div>
  );
}

function MenuLink({ href, children, active }) {
  return <Link role="menuitem" href={href} aria-current={active ? 'page' : undefined}>{children}</Link>;
}

export default function DesktopNavMenus({ reviewer, admin, superAdmin }) {
  const pathname = usePathname();
  const discoverActive = ['/events', '/opportunities', '/announcements'].some(route => pathname === route || pathname.startsWith(`${route}/`));
  const workspaceActive = pathname === '/admin' || pathname.startsWith('/admin/');
  return (
    <>
      <Link href="/" className={pathname === '/' ? 'active' : ''} aria-current={pathname === '/' ? 'page' : undefined}>Home</Link>
      <MenuGroup label="Discover" menuLabel="Discover links" active={discoverActive}>
        <MenuLink href="/events" active={pathname.startsWith('/events')}>Events</MenuLink>
        <MenuLink href="/opportunities" active={pathname.startsWith('/opportunities')}>Opportunities</MenuLink>
        <MenuLink href="/announcements" active={pathname.startsWith('/announcements')}>Announcements</MenuLink>
      </MenuGroup>
      <Link href="/about">Who Is C.O.D.E.?</Link>
      {reviewer && (
        <MenuGroup label="Workspace" href="/admin" menuLabel="Workspace links" active={workspaceActive}>
          <MenuLink href="/admin" active={pathname === '/admin'}>Overview</MenuLink>
          <MenuLink href="/admin/review">Review Queue</MenuLink>
          <MenuLink href="/admin/committee">Contributor Approvals</MenuLink>
          {admin && <>
            <MenuLink href="/admin/content">Content Management</MenuLink>
            <MenuLink href="/admin/people">People &amp; Access</MenuLink>
          </>}
          <MenuLink href="/admin/analytics">Analytics</MenuLink>
          {superAdmin && <>
            <span className="desktop-nav-menu-label">Super Admin</span>
            <MenuLink href="/admin/history">History</MenuLink>
            <MenuLink href="/admin/system">System Insights</MenuLink>
          </>}
        </MenuGroup>
      )}
    </>
  );
}
