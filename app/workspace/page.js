import { redirect } from 'next/navigation';
import { canReview, canSubmit, getViewer } from '../../lib/auth';

export const metadata = { title: 'Workspace' };

export default async function WorkspaceGateway() {
  const viewer = await getViewer();

  if (!viewer.user) redirect('/auth/signin?next=%2Fworkspace');
  if (canReview(viewer)) redirect('/admin');
  if (canSubmit(viewer)) redirect('/panther-submit');

  // Signed-in users without an active role receive the existing access-request
  // and status experience; role labels never appear in this gateway response.
  redirect('/panther-submit');
}
