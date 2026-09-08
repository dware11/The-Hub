import { NextResponse } from 'next/server';
import { createServerSupabaseClient, isDemoMode } from '../../../lib/supabaseServerClient';
import { safeAuthDestination } from '../../../lib/authRedirects';

export async function GET(request) {
  const url = new URL(request.url);
  const next = safeAuthDestination(url.searchParams.get('next'));
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') || 'email';
  if (isDemoMode) return NextResponse.redirect(`${url.origin}${next}`);
  if (!tokenHash || !['email', 'magiclink', 'recovery', 'invite'].includes(type)) return NextResponse.redirect(`${url.origin}/auth/error?reason=invalid_link`);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) return NextResponse.redirect(`${url.origin}/auth/error?reason=invalid_link`);
  return NextResponse.redirect(`${url.origin}${next}`);
}
