'use client';

import { createClient, isDemoMode } from '../lib/supabaseClient';

// Microsoft's four-pane logo — used on the sign-in button per Microsoft's
// branding guidelines for "Sign in with Microsoft".
function MicrosoftMark() {
  return (
    <svg viewBox="0 0 23 23" width="16" height="16" fill="none">
      <rect x="1" y="1" width="10" height="10" fill="#F35325" />
      <rect x="12" y="1" width="10" height="10" fill="#81BC06" />
      <rect x="1" y="12" width="10" height="10" fill="#05A6F0" />
      <rect x="12" y="12" width="10" height="10" fill="#FFBA08" />
    </svg>
  );
}

export default function SignInButton({ className, next = '/panther-submit' }) {
  async function handleSignIn() {
    if (isDemoMode) {
      alert('Demo mode — Microsoft sign-in requires Supabase to be configured. See README.');
      return;
    }
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'email openid profile',
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  return (
    <button
      onClick={handleSignIn}
      className={
        className ||
        'flex items-center gap-2 bg-purple-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-purple-700'
      }
    >
      <MicrosoftMark />
      Sign in
    </button>
  );
}
