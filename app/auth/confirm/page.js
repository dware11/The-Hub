import { redirect } from 'next/navigation';
import { optionalSafeAuthDestination } from '../../../lib/authRedirects';

export const metadata = { title: 'Confirm Sign In' };

export default async function AuthConfirmPage({ searchParams }) {
  const params = await searchParams;
  const next = optionalSafeAuthDestination(params?.next);
  const signInUrl = next
    ? `/auth/signin?next=${encodeURIComponent(next)}`
    : '/auth/signin';

  // The Hub now uses a typed six-digit OTP. Keep this historical callback URL
  // as a clean compatibility redirect without mounting the retired link UI.
  redirect(signInUrl);
}
