import { redirect } from 'next/navigation';
import { getViewer, isSuperAdmin } from '../../../../lib/auth';
import { getApprovedOrganizationOptions } from '../../../../lib/peopleData';
import InvitePersonForm from './InvitePersonForm';

export default async function InvitePersonPage() {
  const viewer = await getViewer();
  if (!isSuperAdmin(viewer)) redirect('/admin/people');
  const organizations = await getApprovedOrganizationOptions(viewer);
  return <div className="review-page workspace-subpage">
    <div className="workspace-page-heading"><div><div className="eyebrow">People &amp; Access</div><h1>Invite Person</h1><p>Approve a PVAMU email for Hub access. Their selected access activates only after they sign in with a six-digit verification code.</p></div></div>
    <InvitePersonForm organizations={organizations} reporterEmail={viewer.user?.email || ''} />
  </div>;
}
