import { NextResponse, type NextRequest } from 'next/server';
import { fromCompact, toCsv, toGpx, toIgc, toKml } from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import { displayNames } from '@/lib/people';
import { getFlight, siteLabel, visibleTrack } from '@/lib/flights';

const TYPES = {
  igc: 'application/vnd.fai.igc; charset=utf-8',
  gpx: 'application/gpx+xml; charset=utf-8',
  kml: 'application/vnd.google-earth.kml+xml; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
} as const;
type Format = keyof typeof TYPES;

/**
 * Track download. The owner gets the full track (and their original IGC file when there is
 * one); everyone else gets the copy with the first and last 500 m removed.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = request.nextUrl.searchParams.get('format') ?? 'gpx';
  if (!(format in TYPES)) return NextResponse.json({ error: 'bad_format' }, { status: 400 });

  const flight = await getFlight(id);
  if (!flight) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = user?.id === flight.user_id;
  const fileName = `flight-${flight.started_at.slice(0, 16).replace(/[-:]/g, '').replace('T', '-')}.${format}`;

  let body: string | Blob | null = null;
  if (isOwner && format === 'igc' && flight.file_path?.endsWith('.igc')) {
    const { data } = await supabase.storage.from('flight-files').download(flight.file_path);
    body = data;
  }
  if (!body) {
    const { track } = await visibleTrack(flight, user?.id);
    if (!track) return NextResponse.json({ error: 'no_track' }, { status: 404 });
    const points = fromCompact(track);
    const name = siteLabel(flight) ?? 'Flight';
    const pilot = (await displayNames(supabase, [flight.user_id])).get(flight.user_id);
    body = {
      igc: () => toIgc(points, { pilot, glider: flight.glider ?? undefined }),
      gpx: () => toGpx(points, name),
      kml: () => toKml(points, name),
      csv: () => toCsv(points),
    }[format as Format]();
  }

  return new NextResponse(body, {
    headers: {
      'Content-Type': TYPES[format as Format],
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
