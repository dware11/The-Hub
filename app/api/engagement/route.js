import { NextResponse } from 'next/server';
import { createServerSupabaseClient, isDemoMode } from '../../../lib/supabaseServerClient';
import { validEngagement } from '../../../lib/engagement';

export const dynamic = 'force-dynamic';

function accepted() {
  return new NextResponse(null, { status: 202, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request) {
  try {
    const size = Number(request.headers.get('content-length') || 0);
    if (size > 2048) return accepted();
    const payload = await request.json();
    if (!validEngagement(payload) || isDemoMode) return accepted();

    const supabase = await createServerSupabaseClient();
    await supabase.rpc('record_engagement', {
      p_content_type: payload.contentType,
      p_content_id: payload.contentId.trim(),
      p_action: payload.action,
    });
  } catch {
    // Aggregate telemetry is deliberately non-blocking and best effort.
  }
  return accepted();
}
