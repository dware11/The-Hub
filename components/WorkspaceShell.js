import Link from 'next/link';
import Image from 'next/image';
import { getViewer, isAdmin, isSuperAdmin } from '../lib/auth';
import WorkspaceNavigation from './WorkspaceNavigation';

export default async function WorkspaceShell({ children }) {
  const viewer = await getViewer();
  const signedIn = Boolean(viewer.user);
  const admin = isAdmin(viewer);
  const superAdmin = isSuperAdmin(viewer);
  return <div className="workspace-shell">
    <aside className="workspace-sidebar" aria-label="Workspace">
      <div className="workspace-sidebar-brand"><Image className="workspace-logo" src="/code-crest.png" alt="" width={38} height={38} /><div><strong>Workspace</strong><small>C.O.D.E. Engineering Hub</small></div></div>
      <WorkspaceNavigation admin={admin} superAdmin={superAdmin} />
      <a className="workspace-problem-link" href="mailto:code@pvamu.edu?subject=Engineering%20Hub%20problem">Report a Problem</a>
      {!signedIn && <p className="workspace-sidebar-note">Sign in with an approved Hub role to access workspace actions.</p>}
    </aside>
    <div className="workspace-main"><header className="workspace-topbar"><div><span className="eyebrow">C.O.D.E. operations</span><strong>{viewer.role?.role ? viewer.role.role.replaceAll('_', ' ') : 'Read-only access'}</strong></div><Link href="/" className="workspace-back-link">Back to Hub →</Link></header>{children}</div>
  </div>;
}
