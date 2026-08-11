import Link from 'next/link';
import { isDemoMode } from '../lib/supabaseClient';
import { getViewer, canReview } from '../lib/auth';
import SignInButton from './SignInButton';

export default async function Nav() {
  const viewer = await getViewer();
  const signedIn = Boolean(viewer.user);
  const reviewer = canReview(viewer);
  return (
    <nav className="site-nav">
      {isDemoMode && <div className="demo-bar">DEMO MODE — sample information only</div>}
      <div className="nav-inner">
        <Link href="/" className="brand"><span className="brand-mark">C·E</span><span><strong>C.O.D.E. Engineering Hub</strong><small>Prairie View A&amp;M · College of Engineering</small></span></Link>
        <div className="nav-links">
          <Link href="/">Home</Link><Link href="/events">Events</Link><Link href="/opportunities">Opportunities</Link><Link href="/announcements">Announcements</Link><Link href="/about">About</Link>
          {reviewer && <Link href="/admin/review">Review queue</Link>}
        </div>
        <div className="nav-actions">
          {signedIn ? <><span className="viewer-email">{viewer.user.email}</span><Link href="/panther-submit" className="gold-button">Submit</Link>{!viewer.demo && <form action="/auth/signout" method="post"><button type="submit">Sign out</button></form>}</> : <SignInButton className="gold-button" />}
        </div>
      </div>
    </nav>
  );
}
