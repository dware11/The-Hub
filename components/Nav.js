import { getViewer, canReview, isAdmin, isSuperAdmin } from '../lib/auth';
import SignInButton from './SignInButton';
import NavBrand from './NavBrand';
import MobileNav from './MobileNav';
import DesktopNavMenus from './DesktopNavMenus';
import RouteAwareNav from './RouteAwareNav';

export default async function Nav() {
  const viewer = await getViewer();
  const signedIn = Boolean(viewer.user);
  const reviewer = canReview(viewer);
  const admin = isAdmin(viewer);
  const superAdmin = isSuperAdmin(viewer);
  return <RouteAwareNav>{(
    <nav className="site-nav">
      <div className="nav-inner">
        <NavBrand />
        <div className="nav-links">
          <DesktopNavMenus reviewer={reviewer} admin={admin} superAdmin={superAdmin} />
        </div>
        <div className="nav-actions">
          {signedIn ? <><span className="viewer-email">{viewer.user.email}</span>{!viewer.demo && <form action="/auth/signout" method="post"><button type="submit">Sign out</button></form>}</> : <SignInButton className="gold-button" />}
        </div>
      </div>
      <MobileNav reviewer={reviewer} admin={admin} superAdmin={superAdmin} />
    </nav>
  )}</RouteAwareNav>;
}
