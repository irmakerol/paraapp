import { NextResponse } from 'next/server';
import { z } from 'zod';
import { licenceNumberSchema } from '@paraapp/core';
import { bearerViewer } from '@/lib/supabase/bearer';
import { decryptField, encryptField } from '@/lib/crypto';
import { serverEnv } from '@/lib/env';

// The licence number is encrypted with a server-only key, so the phone app reads and writes it
// here (owner only, through their own session and RLS on profile_private).

export async function GET(request: Request) {
  const auth = await bearerViewer(request);
  if (!auth) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const { data } = await auth.supabase
    .from('profile_private')
    .select('licence_number_enc')
    .eq('user_id', auth.viewer.user.id)
    .maybeSingle();
  let licence = '';
  if (data?.licence_number_enc) {
    try {
      licence = decryptField(data.licence_number_enc, serverEnv().LICENCE_ENCRYPTION_KEY);
    } catch {
      licence = '';
    }
  }
  return NextResponse.json({ ok: true, licence }, { headers: { 'Cache-Control': 'no-store' } });
}

const bodySchema = z.object({ licence: licenceNumberSchema });

export async function PUT(request: Request) {
  const auth = await bearerViewer(request);
  if (!auth) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'validation' }, { status: 400 });
  }
  const value = parsed.data.licence;
  const { error } = await auth.supabase
    .from('profile_private')
    .update({
      licence_number_enc: value ? encryptField(value, serverEnv().LICENCE_ENCRYPTION_KEY) : null,
    })
    .eq('user_id', auth.viewer.user.id);
  if (error) return NextResponse.json({ ok: false, error: 'generic' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
