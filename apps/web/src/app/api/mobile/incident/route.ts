import { NextResponse } from 'next/server';
import { incidentSchema } from '@paraapp/core';
import { bearerViewer } from '@/lib/supabase/bearer';
import { fileIncident } from '@/lib/incidents';

/**
 * Incident reports from the phone app. A server route (not a direct insert) because fully
 * anonymous reports are written without a user id and injury details are encrypted here.
 */
export async function POST(request: Request) {
  const auth = await bearerViewer(request);
  if (!auth || auth.onboardingStep) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const body: unknown = await request.json().catch(() => null);
  const parsed = incidentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'validation', fields: parsed.error.issues.map((i) => String(i.path[0])) },
      { status: 400 },
    );
  }
  const error = await fileIncident(auth.supabase, auth.viewer.user.id, parsed.data);
  if (error) return NextResponse.json({ ok: false, error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
