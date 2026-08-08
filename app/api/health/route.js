import { NextResponse } from 'next/server';
import { checkApplicationHealth, toPublicHealth } from '../../../lib/health';

export const dynamic = 'force-dynamic';

export async function GET() {
  const health = await checkApplicationHealth();
  const statusCode = health.status === 'unavailable' ? 503 : 200;
  return NextResponse.json(toPublicHealth(health), {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
