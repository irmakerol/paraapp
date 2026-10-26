import { NextResponse } from 'next/server';
import { APP_CONFIG } from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import { decryptField } from '@/lib/crypto';
import { serverEnv } from '@/lib/env';

/** "Download my data" (KVKK Art. 11 / GDPR Arts. 15 and 20). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const [profile, priv, roles, consents, acceptances, requests, guardians] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('profile_private').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('user_roles').select('role, granted_at').eq('user_id', user.id),
    supabase
      .from('consents')
      .select('consent_type, granted, method, created_at, document_id')
      .eq('user_id', user.id)
      .order('created_at'),
    supabase
      .from('legal_acceptances')
      .select('document_id, accepted_at, legal_documents(kind, locale, version)')
      .eq('user_id', user.id),
    supabase
      .from('data_requests')
      .select('request_type, channel, status, received_at, due_at, completed_at, details')
      .eq('user_id', user.id),
    supabase
      .from('guardian_consents')
      .select('guardian_name, guardian_email, created_at, expires_at, confirmed_at')
      .eq('user_id', user.id),
  ]);

  let licence: string | null = null;
  if (priv.data?.licence_number_enc) {
    try {
      licence = decryptField(priv.data.licence_number_enc, serverEnv().LICENCE_ENCRYPTION_KEY);
    } catch {
      licence = null;
    }
  }

  const body = {
    exported_at: new Date().toISOString(),
    controller: APP_CONFIG.club,
    account: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      providers: user.app_metadata.providers ?? [],
    },
    profile: profile.data,
    private: { birth_date: priv.data?.birth_date ?? null, licence_number: licence },
    roles: roles.data ?? [],
    consents: consents.data ?? [],
    legal_acceptances: acceptances.data ?? [],
    data_requests: requests.data ?? [],
    guardian_consents: guardians.data ?? [],
  };

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${APP_CONFIG.name.toLowerCase()}-my-data-${date}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
