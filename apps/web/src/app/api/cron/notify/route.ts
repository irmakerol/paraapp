import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { serverEnv } from '@/lib/env';
import { notifyDueNews, pushPendingNotifications } from '@/lib/notify';

export const dynamic = 'force-dynamic';

function authorised(request: NextRequest): boolean {
  const secret = serverEnv().CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Called every few minutes by a scheduler (see docs/ARCHITECTURE.md): sends scheduled club
 * news and ad expiry reminders as push notifications.
 */
export async function POST(request: NextRequest) {
  if (!authorised(request)) return new NextResponse(null, { status: 401 });
  const [news, reminders] = await Promise.all([notifyDueNews(), pushPendingNotifications()]);
  return NextResponse.json({ news, reminders });
}
