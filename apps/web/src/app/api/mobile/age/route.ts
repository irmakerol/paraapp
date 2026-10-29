import { NextResponse } from 'next/server';
import { ageGroup, isoDateSchema, todayIso } from '@paraapp/core';
import { createAdminClient } from '@/lib/supabase/admin';
import { bearerViewer } from '@/lib/supabase/bearer';

/** The age step of onboarding for the phone app (same rules as the web `submitAge`). */
export async function POST(request: Request) {
  const auth = await bearerViewer(request);
  if (!auth) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const raw =
    body && typeof body === 'object' ? (body as Record<string, unknown>).birth_date : null;
  const parsed = isoDateSchema.safeParse(raw);
  if (!parsed.success)
    return NextResponse.json({ ok: false, error: 'invalidDate' }, { status: 400 });

  if (ageGroup(parsed.data, todayIso()) === 'too_young') {
    // Under the minimum age: remove the account straight away instead of keeping any data.
    await createAdminClient().auth.admin.deleteUser(auth.viewer.user.id);
    return NextResponse.json({ ok: false, error: 'tooYoung' }, { status: 400 });
  }
  const { error } = await auth.supabase.rpc('complete_age_gate', { p_birth_date: parsed.data });
  if (error && !error.message.includes('age_gate_already_completed')) {
    const code = error.message.includes('invalid_birth_date') ? 'invalidDate' : 'generic';
    return NextResponse.json({ ok: false, error: code }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
