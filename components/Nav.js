import Link from 'next/link';
import { isDemoMode } from '../lib/supabaseClient';
import { getViewer, isAdmin } from '../lib/auth';
import SignInButton from './SignInButton';

export default async function Nav() {
  const viewer = await getViewer();
  const signedIn = Boolean(viewer.user);
  const admin = isAdmin(viewer);

  return (
    <nav className="border-b border-line bg-white sticky top-0 z-20">
      {isDemoMode && (
        <div className="bg-gold-100 text-gold-600 text-xs text-center py-1 font-mono">
          DEMO MODE — showing sample data. Connect Supabase to go live (see README).
        </div>
      )}
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-purple-900 flex items-center justify-center text-gold-400 font-display font-bold text-xs">
            C
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-display font-semibold text-sm text-purple-900">
              C.O.D.E. Engineering Hub
            </span>
            <span className="text-[11px] font-mono text-slate tracking-wide">
              PRAIRIE VIEW A&amp;M · COE
            </span>
          </div>
        </Link>
        <div className="hidden md:flex gap-7 text-sm font-medium">
          <Link href="/" className="hover:border-b-2 hover:border-gold-400 pb-1">Home</Link>
          <Link href="/events" className="hover:border-b-2 hover:border-gold-400 pb-1">Events</Link>
          <Link href="/opportunities" className="hover:border-b-2 hover:border-gold-400 pb-1">Opportunities</Link>
          <Link href="/announcements" className="hover:border-b-2 hover:border-gold-400 pb-1">Announcements</Link>
          {admin && (
            <Link href="/admin/review" className="hover:border-b-2 hover:border-gold-400 pb-1 text-purple-700">
              Review queue
            </Link>
          )}
        </div>
        {signedIn ? (
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-slate hidden sm:inline">{viewer.user.email}</span>
            <Link
              href="/submit"
              className="bg-purple-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-purple-700"
            >
              Submit
            </Link>
            {!viewer.demo && (
              <form action="/auth/signout" method="post">
                <button className="text-sm text-slate hover:text-ink" type="submit">
                  Sign out
                </button>
              </form>
            )}
          </div>
        ) : (
          <SignInButton />
        )}
      </div>
    </nav>
  );
}
