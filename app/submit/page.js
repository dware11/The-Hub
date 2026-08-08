import Link from 'next/link';
import { getViewer, isVerifiedContributor } from '../../lib/auth';
import SignInButton from '../../components/SignInButton';
import SubmitForm from '../../components/SubmitForm';

export default async function SubmitPage() {
  const viewer = await getViewer();

  if (!viewer.user) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <h1 className="font-display text-xl text-purple-900 mb-2">Sign in to submit</h1>
        <p className="text-sm text-slate mb-6">
          Submitting to the Hub requires signing in with your PVAMU Microsoft account so C.O.D.E. knows
          who posted what.
        </p>
        <div className="flex justify-center">
          <SignInButton />
        </div>
      </div>
    );
  }

  if (!isVerifiedContributor(viewer)) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <h1 className="font-display text-xl text-purple-900 mb-2">Not yet a verified contributor</h1>
        <p className="text-sm text-slate mb-2">
          {viewer.role
            ? "Your account is on file but hasn't been approved to post yet."
            : "We don't have your account on file as a contributor yet."}
        </p>
        <p className="text-sm text-slate mb-6">
          Reach out to C.O.D.E. to get added as an org president, faculty, or student contributor —
          this is a manual step so only verified people can post to the whole college.
        </p>
        <Link href="/" className="text-sm text-purple-700 hover:underline">
          ← Back to the Hub
        </Link>
      </div>
    );
  }

  return <SubmitForm viewer={viewer} />;
}
