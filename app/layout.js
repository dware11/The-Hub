import './globals.css';
import Nav from '../components/Nav';
import ConnectDock from '../components/ConnectDock';
import RouteAwareNav from '../components/RouteAwareNav';
import SiteFooter from '../components/SiteFooter';

export const metadata = {
  title: { default: 'C.O.D.E. Engineering Hub', template: '%s | C.O.D.E. Engineering Hub' },
  description: 'Student opportunities, events, and announcements at Prairie View A&M University.',
  icons: { icon: '/code-crest.png' },
};

export default function RootLayout({ children }) {
  return <html lang="en"><head><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" /></head><body><a className="skip-link" href="#main-content">Skip to main content</a><Nav /><main id="main-content" tabIndex="-1">{children}</main><RouteAwareNav><ConnectDock /></RouteAwareNav><SiteFooter /></body></html>;
}
