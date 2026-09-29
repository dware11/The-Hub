import { getViewer, canReview, canSubmit, isAdmin, isSuperAdmin } from '../lib/auth';
import SignInButton from './SignInButton';
import NavBrand from './NavBrand';
import MobileNav from './MobileNav';
import DesktopNavMenus from './DesktopNavMenus';
import RouteAwareNav from './RouteAwareNav';
import SignOutButton from './SignOutButton';

export default async function Nav() {
  const viewer = await getViewer();
  const signedIn = Boolean(viewer.user);
  const reviewer = canReview(viewer);
  const contributor = canSubmit(viewer) && !reviewer;
  const admin = isAdmin(viewer);
  const superAdmin = isSuperAdmin(viewer);
  return <RouteAwareNav>{(
    <nav className="site-nav">
      <div className="nav-inner">
        <NavBrand />
        <div className="nav-links">
          <DesktopNavMenus reviewer={reviewer} contributor={contributor} admin={admin} superAdmin={superAdmin} />
        </div>
        <div className="nav-actions">
          {signedIn ? <><span className="viewer-email">{viewer.user.email}</span>{!viewer.demo && <SignOutButton />}</> : <SignInButton className="nav-sign-in-button" next="/workspace" />}
        </div>
      </div>
      <MobileNav reviewer={reviewer} contributor={contributor} admin={admin} superAdmin={superAdmin} />
    </nav>
  )}</RouteAwareNav>;
}
