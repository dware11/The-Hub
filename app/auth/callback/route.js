import { NextResponse } from 'next/server';
import { createServerSupabaseClient, isDemoMode } from '../../../lib/supabaseServerClient';
import { safeAuthDestination } from '../../../lib/authRedirects';

// Compatibility endpoint for an already-issued PKCE callback. The current Hub
// sign-in screen verifies a typed OTP directly and does not render this route.
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
