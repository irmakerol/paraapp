import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/session';
import { displayNames } from '@/lib/people';
import { csvRow } from '@/lib/csv';

/** Participant list as CSV for the trip's staff (RLS returns nothing to anyone else). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success || !(await getUser()))
    return new NextResponse('Not found', { status: 404 });
  const supabase = await createClient();
  const [{ data: trip }, { data: regs }] = await Promise.all([
    supabase.from('trips').select('slug').eq('id', id).maybeSingle(),
    supabase.from('trip_registrations').select('*').eq('trip_id', id).order('created_at'),
  ]);
  if (!trip || !regs?.length) return new NextResponse('Not found', { status: 404 });
  const names = await displayNames(
    supabase,
    regs.map((r) => r.user_id),
  );
  const lines = [
    csvRow([
      'name',
      'status',
      'payment',
      'companions',
      'pilot_level',
      'years_flying',
      'logged_flights',
      'phone',
      'emergency_name',
      'emergency_phone',
      'note',
      'staff_note',
      'registered_at',
    ]),
    ...regs.map((r) =>
      csvRow([
        names.get(r.user_id) ?? '',
        r.status,
        r.payment_status,
        r.companions,
        r.pilot_level,
        r.years_flying,
        r.logged_flights,
        r.phone,
        r.emergency_name,
        r.emergency_phone,
        r.note,
        r.staff_note,
        r.created_at,
      ]),
    ),
  ];
  return new NextResponse(`﻿${lines.join('\r\n')}\r\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${trip.slug}-participants.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
