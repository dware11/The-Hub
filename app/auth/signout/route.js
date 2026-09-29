import { NextResponse } from 'next/server';
import { createServerSupabaseClient, isDemoMode } from '../../../lib/supabaseServerClient';

export async function POST(request) {
  const { origin } = new URL(request.url);
  if (!isDemoMode) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  }
  const response = NextResponse.redirect(origin, { status: 303 });
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  response.headers.set('Clear-Site-Data', '"cache"');
  return response;
}
