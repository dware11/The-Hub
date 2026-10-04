import WorkspaceShell from '../../components/WorkspaceShell';
import { canReview, getViewer } from '../../lib/auth';
import { redirect } from 'next/navigation';
export const metadata = { title: 'Workspace' };

export default async function AdminLayout({ children }) {
  const viewer = await getViewer();
  if (!viewer.user) redirect('/auth/signin?next=%2Fworkspace');
  if (!canReview(viewer)) redirect('/workspace');
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
