import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { importTrack } from '@/lib/flight-import';
import { bearerViewer } from '@/lib/supabase/bearer';

/** Upload from the phone tracker: one IGC file per request, analysed like a web import. */
export async function POST(request: Request) {
  const auth = await bearerViewer(request);
  if (!auth) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  if (auth.onboardingStep) {
    return NextResponse.json({ ok: false, error: 'onboarding' }, { status: 403 });
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'unsupported' }, { status: 400 });
  }
  const result = await importTrack(auth.viewer, file);
  if (result.ok) revalidatePath('/[locale]/logbook', 'page');
  return NextResponse.json(result, {
    status: result.ok || result.error === 'duplicate' ? 200 : 400,
  });
}
