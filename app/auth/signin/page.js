import EmailSignInForm from '../../../components/EmailSignInForm';
import { safeAuthDestination } from '../../../lib/authRedirects';

export const metadata = { title: 'Sign In' };

export default async function SignInPage({ searchParams }) {
  const params = await searchParams;
  const next = safeAuthDestination(params?.next);
  return <div className="auth-card"><div className="eyebrow">Passwordless access</div><h1>Sign in with your email</h1><p>We send a one-time secure link. A verified @pvamu.edu address proves mailbox control only; it does not grant a role automatically.</p><p>External emails authenticate as guest viewers and may request contributor access.</p><EmailSignInForm next={next} /></div>;
}
