import { NextResponse } from 'next/server';
import { createServerSupabaseClient, isDemoMode } from '../../../lib/supabaseServerClient';
import { safeAuthDestination } from '../../../lib/authRedirects';

// Supabase Auth redirects here after a user finishes signing in with
// Exchanges the auth code for a session cookie, then
// sends them back to wherever they were headed (default: the submit page).
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeAuthDestination(searchParams.get('next'));

  if (isDemoMode) return NextResponse.redirect(`${origin}${next}`);

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { error: claimError } = await supabase.rpc('claim_my_role');
      if (claimError) return NextResponse.redirect(`${origin}/auth/error?reason=role_claim_failed`);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`);
}
