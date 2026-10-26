import { NextResponse } from 'next/server';
import { z } from 'zod';
import { toIcs } from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import { eventLocation } from '@/lib/events';

/** Calendar file for one event the requester can see (RLS decides). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return new NextResponse('Not found', { status: 404 });
  const supabase = await createClient();
  const { data: e } = await supabase
    .from('events')
    .select(
      'id, slug, title, description_md, starts_at, ends_at, status, location_text, updated_at, sites:site_id(name)',
    )
    .eq('id', id)
    .maybeSingle();
  if (!e) return new NextResponse('Not found', { status: 404 });
  const url = new URL(`/tr/events/${e.slug}`, publicEnv.NEXT_PUBLIC_SITE_URL).toString();
  const ics = toIcs({
    uid: `${e.id}@paraapp`,
    title: e.title,
    description: `${e.description_md.slice(0, 1500)}\n\n${url}`.trim(),
    location: eventLocation(e),
    url,
    startsAt: e.starts_at,
    endsAt: e.ends_at,
    cancelled: e.status === 'cancelled',
    stamp: e.updated_at,
  });
  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${e.slug}.ics"`,
      'Cache-Control': 'private, max-age=300',
    },
  });
}
