import Link from 'next/link';
import Image from 'next/image';
import { getViewer, isAdmin, isSuperAdmin } from '../lib/auth';
import WorkspaceNavigation from './WorkspaceNavigation';
import WorkspaceIdentityForm from './WorkspaceIdentityForm';

export default async function WorkspaceShell({ children }) {
  const viewer = await getViewer();
  const signedIn = Boolean(viewer.user);
  const admin = isAdmin(viewer);
  const superAdmin = isSuperAdmin(viewer);
  const roleLabel = viewer.role?.role ? viewer.role.role.replaceAll('_', ' ') : 'Read-only access';
  const displayName = viewer.role?.full_name?.trim() || '';
  return <div className="workspace-shell">
    <aside className="workspace-sidebar" aria-label="Workspace">
      <div className="workspace-sidebar-brand"><Image className="workspace-logo" src="/code-crest.png" alt="" width={38} height={38} /><div><strong>Workspace</strong><small>C.O.D.E. Engineering Hub</small></div></div>
      <WorkspaceNavigation admin={admin} superAdmin={superAdmin} />
      {signedIn && viewer.role && <div className="workspace-sidebar-identity"><strong>{displayName || viewer.user.email}</strong><small>{roleLabel}</small></div>}
      <a className="workspace-problem-link" href="mailto:code@pvamu.edu?subject=Engineering%20Hub%20problem">Report a Problem</a>
      {!signedIn && <p className="workspace-sidebar-note">Sign in with an approved Hub role to access workspace actions.</p>}
    </aside>
    <div className="workspace-main"><header className="workspace-topbar"><div><span className="eyebrow">{displayName || viewer.user?.email || 'C.O.D.E. operations'}</span><strong>{roleLabel}</strong></div><Link href="/" className="workspace-back-link">Back to Hub →</Link></header>{signedIn && viewer.role && !displayName && <WorkspaceIdentityForm email={viewer.user.email} />}{children}</div>
  </div>;
}
