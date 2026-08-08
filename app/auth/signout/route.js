import { NextResponse } from 'next/server';
import { createServerSupabaseClient, isDemoMode } from '../../../lib/supabaseServerClient';

export async function POST(request) {
  const { origin } = new URL(request.url);
  if (!isDemoMode) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(origin, { status: 302 });
}
