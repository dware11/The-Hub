import { NextResponse } from 'next/server';
import { createServerSupabaseClient, isDemoMode } from '../../../lib/supabaseServerClient';

// Supabase Auth redirects here after a user finishes signing in with
// Microsoft (Azure AD). Exchanges the auth code for a session cookie, then
// sends them back to wherever they were headed (default: the submit page).
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/submit';

  if (isDemoMode) return NextResponse.redirect(`${origin}${next}`);

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/auth/error`);
}
