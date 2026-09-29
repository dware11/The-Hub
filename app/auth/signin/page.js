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
    <p className="auth-card-lead">We’ll send you a secure one-time sign-in link. No password needed.</p>
    <EmailSignInForm next={next} />
    <p className="auth-card-support">You’ll return to the page you originally requested after signing in.</p>
    <p className="auth-card-note">Already requested a link? Check your inbox before requesting another.</p>
  </div></section>;
}
