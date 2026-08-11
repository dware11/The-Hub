import './globals.css';
import Nav from '../components/Nav';

export const metadata = { title: 'C.O.D.E. Engineering Hub', description: 'Student opportunities, events, and announcements at Prairie View A&M University.' };

export default function RootLayout({ children }) {
  return <html lang="en"><head><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" /></head><body><Nav /><main>{children}</main></body></html>;
}
