import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFlight, visibleTrack } from '@/lib/flights';

/**
 * The track as the viewer may see it, for replaying several flights together. RLS decides
 * whether the flight is visible; other people only get the copy without the first and last 500 m.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const flight = await getFlight(id);
  if (!flight) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { track, trimmed } = await visibleTrack(flight, user?.id);
  if (!track) return NextResponse.json({ error: 'no_track' }, { status: 404 });
  return NextResponse.json(
    { track, trimmed },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
