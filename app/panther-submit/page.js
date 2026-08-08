import Link from 'next/link';
import { getViewer, isVerifiedContributor } from '../../lib/auth';
import SignInButton from '../../components/SignInButton';
import PantherSubmitForm from '../../components/PantherSubmitForm';

export const metadata = { title: 'Submit | Panther Hub' };

export default async function PantherSubmitPage() {
  const viewer = await getViewer();

  if (!viewer.user) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <h1 className="font-display text-xl text-purple-900 mb-2">Sign in to submit</h1>
        <p className="text-sm text-slate mb-6">Panther Hub uses your approved contributor identity to preserve source ownership and review history.</p>
        <div className="flex justify-center"><SignInButton next="/panther-submit" /></div>
      </div>
    );
  }

  if (!isVerifiedContributor(viewer)) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <h1 className="font-display text-xl text-purple-900 mb-2">Contributor approval required</h1>
        <p className="text-sm text-slate mb-6">Your Microsoft identity is signed in, but an active Panther Hub contributor role is required before submitting college-wide content.</p>
        <Link href="/" className="text-sm text-purple-700 hover:underline">Back to Panther Hub</Link>
      </div>
    );
  }

  return <PantherSubmitForm viewer={viewer} />;
}
