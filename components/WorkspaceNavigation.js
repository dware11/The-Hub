'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const WORKSPACE_NAV_ITEMS = [
  { label: 'Overview', href: '/admin' },
  { label: 'Review Queue', href: '/admin/review' },
  { label: 'Content Management', href: '/admin/content', adminOnly: true },
  { label: 'People & Access', href: '/admin/people', adminOnly: true },
  { label: 'Issues', href: '/admin/issues', adminOnly: true },
  { label: 'Analytics', href: '/admin/analytics' },
];

const SUPER_ADMIN_NAV_ITEMS = [
  { label: 'History', href: '/admin/history' },
  { label: 'System Insights', href: '/admin/system' },
];

function isActivePath(pathname, href) {
  return href === '/admin' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export default function WorkspaceNavigation({ admin, superAdmin }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = WORKSPACE_NAV_ITEMS.filter(item => !item.adminOnly || admin);

  const renderLink = item => (
    <Link
      key={item.href}
      href={item.href}
      className="workspace-nav-link"
      aria-current={isActivePath(pathname, item.href) ? 'page' : undefined}
      onClick={() => setOpen(false)}
    >
      {item.label}
    </Link>
  );

  return <>
    <button
      type="button"
      className="workspace-nav-toggle"
      aria-expanded={open}
      aria-controls="workspace-navigation"
      onClick={() => setOpen(value => !value)}
    >
      Workspace navigation <span aria-hidden="true">{open ? '−' : '+'}</span>
    </button>
    <nav
      id="workspace-navigation"
      className={`workspace-nav${open ? ' is-open' : ''}`}
      aria-label="Workspace navigation"
    >
      {items.map(renderLink)}
      {superAdmin && <>
        <span className="workspace-nav-label">Super Admin</span>
        {SUPER_ADMIN_NAV_ITEMS.map(renderLink)}
      </>}
    </nav>
  </>;
}
