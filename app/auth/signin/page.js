import EmailSignInForm from '../../../components/EmailSignInForm';
import { safeAuthDestination } from '../../../lib/authRedirects';
import Image from 'next/image';

export const metadata = { title: 'Sign In' };

export default async function SignInPage({ searchParams }) {
  const params = await searchParams;
  const next = safeAuthDestination(params?.next);
  return <section className="auth-page-shell"><div className="auth-card" aria-labelledby="auth-signin-title">
    <div className="auth-card-brand"><Image src="/code-crest.png" alt="" width={54} height={54} priority /><div><strong>C.O.D.E.</strong><span>Engineering Hub</span></div></div>
    <div className="eyebrow">Secure access</div>
    <h1 id="auth-signin-title">Sign in with your email</h1>
    <p className="auth-card-lead">We’ll email you a secure 6-digit sign-in code. No password needed.</p>
    <EmailSignInForm next={next} />
    <p className="auth-card-support">After verification, you’ll continue to the page you originally requested.</p>
    <p className="auth-card-note">Using a PVAMU email address? Delivery may take up to 3 minutes. Please wait before requesting another code.</p>
  </div></section>;
}
