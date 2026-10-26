import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { csvRow } from '@/lib/csv';

const istanbul = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Istanbul',
  dateStyle: 'short',
  timeStyle: 'short',
});

/** The signed-in pilot's whole logbook as CSV (opens in any spreadsheet). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const { data } = await supabase
    .from('flights')
    .select(
      'started_at, duration_s, site_name, glider, distance_m, straight_m, max_alt_m, takeoff_alt_m, landing_alt_m, max_climb_ms, max_sink_ms, visibility, source, notes, takeoff:takeoff_site_id(name), landing:landing_site_id(name), wing:wing_id(brand, model, size)',
    )
    .eq('user_id', user.id)
    .order('started_at');

  const header = [
    'date_time_istanbul',
    'duration_min',
    'takeoff',
    'landing',
    'glider',
    'distance_km',
    'straight_km',
    'max_alt_m',
    'takeoff_alt_m',
    'landing_alt_m',
    'max_climb_ms',
    'max_sink_ms',
    'visibility',
    'source',
    'notes',
  ];
  const km = (m: number | null) => (m == null ? null : (m / 1000).toFixed(2));
  const rows = (data ?? []).map((f) =>
    csvRow([
      istanbul.format(new Date(f.started_at)),
      Math.round(f.duration_s / 60),
      f.takeoff?.name ?? f.site_name,
      f.landing?.name,
      f.wing ? [f.wing.brand, f.wing.model, f.wing.size].filter(Boolean).join(' ') : f.glider,
      km(f.distance_m),
      km(f.straight_m),
      f.max_alt_m,
      f.takeoff_alt_m,
      f.landing_alt_m,
      f.max_climb_ms,
      f.max_sink_ms,
      f.visibility,
      f.source,
      f.notes,
    ]),
  );
  // BOM so Excel reads UTF-8 (Turkish characters) correctly.
  const csv = `﻿${[header.join(','), ...rows].join('\r\n')}\r\n`;
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="logbook-${date}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
