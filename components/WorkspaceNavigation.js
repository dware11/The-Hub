'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const GROUPS = [
  { label: 'Workspace', items: [{ label: 'Overview', href: '/admin' }] },
  { label: 'Review', items: [{ label: 'Review Queue', href: '/admin/review' }] },
  { label: 'Content', adminOnly: true, items: [{ label: 'Content Management', href: '/admin/content' }] },
  { label: 'Operations', items: [{ label: 'Analytics', href: '/admin/analytics' }, { label: 'Issues', href: '/admin/issues', adminOnly: true }, { label: 'People & Access', href: '/admin/people', adminOnly: true }] },
  { label: 'Super Admin', superOnly: true, items: [{ label: 'System Insights', href: '/admin/system-insights' }, { label: 'History', href: '/admin/history' }] },
];

function isActivePath(pathname, href) {
  return href === '/admin' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export default function WorkspaceNavigation({ admin, superAdmin }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
      {GROUPS.filter(group => (!group.adminOnly || admin) && (!group.superOnly || superAdmin)).map(group => {
        const items = group.items.filter(item => !item.adminOnly || admin);
        return items.length ? <div className="workspace-nav-group" key={group.label}><span className="workspace-nav-label">{group.label}</span>{items.map(renderLink)}</div> : null;
      })}
    </nav>
  </>;
}
