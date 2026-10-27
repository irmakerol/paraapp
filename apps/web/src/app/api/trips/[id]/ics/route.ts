import { NextResponse } from 'next/server';
import { z } from 'zod';
import { toIcs } from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import { tripDestination } from '@/lib/trips';

/** All-day calendar entry for one trip the requester can see (RLS decides). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return new NextResponse('Not found', { status: 404 });
  const supabase = await createClient();
  const { data: trip } = await supabase
    .from('trips')
    .select(
      'id, slug, title, summary, starts_on, ends_on, status, destination_region, destination_country, updated_at',
    )
    .eq('id', id)
    .maybeSingle();
  if (!trip) return new NextResponse('Not found', { status: 404 });
  const url = new URL(`/tr/trips/${trip.slug}`, publicEnv.NEXT_PUBLIC_SITE_URL).toString();
  const ics = toIcs({
    uid: `trip-${trip.id}@paraapp`,
    title: trip.title,
    description: `${trip.summary ?? ''}\n\n${url}`.trim(),
    location: tripDestination(trip, 'tr'),
    url,
    startsAt: trip.starts_on,
    endsAt: trip.ends_on,
    allDay: true,
    cancelled: trip.status === 'cancelled',
    stamp: trip.updated_at,
  });
  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${trip.slug}.ics"`,
      'Cache-Control': 'private, max-age=300',
    },
  });
}
