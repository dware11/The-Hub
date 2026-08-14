import Link from 'next/link';
import { isDemoMode } from '../lib/supabaseClient';
import { getViewer, canReview } from '../lib/auth';
import SignInButton from './SignInButton';

function PrimaryLinks({ reviewer, mobile = false }) {
  return <div className={mobile ? 'mobile-nav-links' : 'nav-links'}>
    <Link href="/">Home</Link>
    <Link href="/events">Events</Link>
    <Link href="/opportunities">Opportunities</Link>
    <Link href="/announcements">Announcements</Link>
    <Link href="/about">About C.O.D.E.</Link>
    {reviewer && <Link href="/admin/review">Review queue</Link>}
  </div>;
}

export default async function Nav() {
  const viewer = await getViewer();
  const signedIn = Boolean(viewer.user);
  const reviewer = canReview(viewer);
  return (
    <nav className="site-nav">
      {isDemoMode && <div className="demo-bar">DEMO MODE • SAMPLE INFORMATION ONLY</div>}
      <div className="values-ribbon">Excellence <span>◆</span> Innovation <span>◆</span> Integrity <span>◆</span> Service <span>◆</span> Leadership</div>
      <div className="header-shell">
        <img src="/pvamu-crest.webp" className="header-pv-seal" alt="" />
        <div className="header-content">
          <div className="brand-row">
            <Link href="/" className="brand">
              <img src="/code-crest.png" className="brand-crest" alt="C.O.D.E. crest" />
              <span className="brand-divider" aria-hidden="true" />
              <span><strong>C.O.D.E. Engineering Hub</strong><small>A Legacy of Panther Engineers</small></span>
            </Link>
            <div className="nav-actions">
              {signedIn ? <><span className="viewer-email">{viewer.user.email}</span><Link href="/panther-submit" className="gold-button">Submit</Link>{!viewer.demo && <form action="/auth/signout" method="post"><button type="submit">Sign out</button></form>}</> : <SignInButton className="gold-button" />}
            </div>
          </div>
          <div className="nav-row"><PrimaryLinks reviewer={reviewer} /></div>
          <details className="mobile-nav">
            <summary>Menu</summary>
            <PrimaryLinks reviewer={reviewer} mobile />
          </details>
        </div>
      </div>
    </nav>
  );
}
