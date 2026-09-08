import { NextResponse } from 'next/server';
import { createServerSupabaseClient, isDemoMode } from '../../../../lib/supabaseServerClient';
import { safeAuthDestination } from '../../../../lib/authRedirects';

const ALLOWED_EMAIL_TYPES = new Set(['email', 'magiclink', 'recovery', 'invite']);

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const tokenHash = typeof body?.token_hash === 'string' ? body.token_hash : '';
  const type = typeof body?.type === 'string' ? body.type : 'email';
  const next = safeAuthDestination(body?.next);

  if (!tokenHash || !ALLOWED_EMAIL_TYPES.has(type)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (isDemoMode) {
    return NextResponse.json({ ok: true, next });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

    if (error) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    return NextResponse.json({ ok: true, next });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
