import Link from 'next/link';

export default function AuthErrorPage({ searchParams }) {
  const roleClaimFailed = searchParams?.reason === 'role_claim_failed';
  return (
    <div className="max-w-md mx-auto mt-20 text-center">
      <h1 className="font-display text-xl text-purple-900 mb-2">Sign-in didn't go through</h1>
      <p className="text-sm text-slate mb-6">
        {roleClaimFailed
          ? 'Your sign-in succeeded, but the Hub could not safely match your email to a pre-approved role. No access was granted. Contact a Hub administrator.'
          : 'Something went wrong finishing your email sign-in. Try again, and if it keeps happening, reach out to C.O.D.E.'}
      </p>
      <Link href="/submit" className="text-sm text-purple-700 hover:underline">
        Back to submit →
      </Link>
    </div>
  );
}
