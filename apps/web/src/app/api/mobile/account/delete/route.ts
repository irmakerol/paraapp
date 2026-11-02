import { NextResponse } from 'next/server';
import { removeUserFiles } from '@/lib/account-files';
import { bearerViewer } from '@/lib/supabase/bearer';

/**
 * Account deletion from the phone app (Apple requires it inside the app). Same steps as the
 * website's `deleteAccount`: uploaded files first, then the anonymise-then-purge request.
 */
export async function POST(request: Request) {
  const auth = await bearerViewer(request);
  if (!auth) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || (body as Record<string, unknown>).confirm !== true) {
    return NextResponse.json({ ok: false, error: 'validation' }, { status: 400 });
  }
  await removeUserFiles(auth.viewer.user.id);
  const { error } = await auth.supabase.rpc('request_account_deletion');
  if (error && !error.message.includes('deletion_already_requested')) {
    return NextResponse.json({ ok: false, error: 'generic' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
