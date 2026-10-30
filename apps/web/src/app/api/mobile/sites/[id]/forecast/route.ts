import { NextResponse } from 'next/server';
import { dailyConditions } from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import { siteForecast } from '@/lib/weather';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A site's forecast for the phone app, from the same server-side cache as the site page (the
 * phone never contacts the weather service). Public, like the site page.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ ok: false }, { status: 404 });
  const supabase = await createClient();
  const { data: site } = await supabase
    .from('sites')
    .select('id, lat, lng, wind_directions')
    .eq('id', id)
    .maybeSingle();
  if (!site) return NextResponse.json({ ok: false }, { status: 404 });
  const forecast = await siteForecast(site);
  if (!forecast) return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  return NextResponse.json(
    {
      ok: true,
      fetchedAt: forecast.fetchedAt,
      days: dailyConditions(forecast.hours),
      hours: forecast.hours.map((h) => ({
        time: h.time,
        windKmh: h.windKmh,
        gustKmh: h.gustKmh,
        directionDeg: h.directionDeg,
        precipitation: h.precipitation,
        temperature: h.temperature,
      })),
    },
    { headers: { 'Cache-Control': 'public, max-age=600' } },
  );
}
