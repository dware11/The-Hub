import { NextResponse } from 'next/server';
import { getDigestItems } from '../../../../lib/data';
import { buildDigestEmail } from '../../../../lib/emailTemplate';

// Triggered weekly by Vercel Cron (see vercel.json). Vercel signs the
// request with `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is
// set on the project -- this checks that so the endpoint can't be spammed
// by anyone who finds the URL.
export async function GET(request) {
  if (process.env.CRON_SECRET) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.DIGEST_FROM_EMAIL;
  const to = process.env.DIGEST_TO_EMAIL;
  if (!resendKey || !from || !to) {
    return NextResponse.json(
      { error: 'Missing RESEND_API_KEY, DIGEST_FROM_EMAIL, or DIGEST_TO_EMAIL env vars' },
      { status: 500 }
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';
  const items = await getDigestItems();
  const totalItems = items.opportunities.length + items.events.length + items.announcements.length;
  if (totalItems === 0) {
    return NextResponse.json({ ok: true, sent: false, reason: 'Nothing to send this week' });
  }

  const html = buildDigestEmail({ ...items, siteUrl });

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: to.split(',').map((addr) => addr.trim()),
      subject: `C.O.D.E. Engineering Hub — this week's opportunities & events`,
      html,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    return NextResponse.json({ ok: false, error: errorBody }, { status: 502 });
  }

  return NextResponse.json({ ok: true, sent: true, itemCount: totalItems });
}
