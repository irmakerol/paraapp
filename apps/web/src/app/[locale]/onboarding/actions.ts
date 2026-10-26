'use server';
import { redirect } from 'next/navigation';
import {
  ageGroup,
  APP_CONFIG,
  guardianSchema,
  isoDateSchema,
  SIGNUP_CONSENTS,
  todayIso,
} from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUser } from '@/lib/session';
import { publicEnv } from '@/lib/env';
import { sendMail } from '@/lib/mailer';
import { routing } from '@/i18n/routing';
import type { ActionState } from '@/lib/action-state';

function localeFrom(formData: FormData): string {
  const value = String(formData.get('locale') ?? '');
  return (routing.locales as readonly string[]).includes(value) ? value : routing.defaultLocale;
}

export async function submitAge(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeFrom(formData);
  const user = await getUser();
  if (!user) redirect(`/${locale}/auth/sign-in`);

  const parsed = isoDateSchema.safeParse(formData.get('birth_date'));
  if (!parsed.success) return { error: 'invalidDate' };

  if (ageGroup(parsed.data, todayIso()) === 'too_young') {
    // Under the minimum age: remove the account straight away instead of keeping any data.
    await createAdminClient().auth.admin.deleteUser(user.id);
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: 'local' });
    return { error: 'tooYoung' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('complete_age_gate', { p_birth_date: parsed.data });
  if (error && !error.message.includes('age_gate_already_completed')) {
    return { error: error.message.includes('invalid_birth_date') ? 'invalidDate' : 'generic' };
  }
  redirect(`/${locale}/onboarding`);
}

export async function acceptLegal(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeFrom(formData);
  const user = await getUser();
  if (!user) redirect(`/${locale}/auth/sign-in`);
  if (formData.get('privacy_ack') !== 'on' || formData.get('terms_accept') !== 'on') {
    return { error: 'validation' };
  }
  const ids = formData.getAll('document_id').map(String).filter(Boolean);
  const supabase = await createClient();
  const { error } = await supabase.from('legal_acceptances').upsert(
    ids.map((document_id) => ({ user_id: user.id, document_id })),
    { onConflict: 'user_id,document_id', ignoreDuplicates: true },
  );
  if (error) return { error: 'generic' };
  redirect(`/${locale}/onboarding`);
}

export async function saveSignupConsents(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = localeFrom(formData);
  const user = await getUser();
  if (!user) redirect(`/${locale}/auth/sign-in`);
  const documentId = String(formData.get('document_id') ?? '') || null;
  const supabase = await createClient();
  const { error } = await supabase.from('consents').insert(
    SIGNUP_CONSENTS.map((consent_type) => ({
      user_id: user.id,
      consent_type,
      granted: formData.get(consent_type) === 'on',
      document_id: documentId,
      method: 'signup' as const,
    })),
  );
  if (error) return { error: 'generic' };
  redirect(`/${locale}/onboarding`);
}

export async function requestGuardianConsent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = localeFrom(formData);
  const user = await getUser();
  if (!user) redirect(`/${locale}/auth/sign-in`);

  const parsed = guardianSchema.safeParse({
    guardian_name: formData.get('guardian_name'),
    guardian_email: formData.get('guardian_email'),
  });
  if (!parsed.success) return { error: 'validation' };
  if (parsed.data.guardian_email === user.email?.toLowerCase()) {
    return { error: 'validation', fieldErrors: { guardian_email: 'validation' } };
  }

  const { data: token, error } = await createAdminClient().rpc('create_guardian_request', {
    p_user: user.id,
    p_name: parsed.data.guardian_name,
    p_email: parsed.data.guardian_email,
  });
  if (error || !token) {
    return { error: error?.message.includes('rate_limited') ? 'rateLimited' : 'generic' };
  }

  const link = `${publicEnv.NEXT_PUBLIC_SITE_URL}/${locale}/guardian/${token}`;
  await sendMail({
    to: parsed.data.guardian_email,
    subject: `${APP_CONFIG.name}: veli onayı / guardian consent`,
    text: [
      `Merhaba ${parsed.data.guardian_name},`,
      '',
      `Çocuğunuz ${APP_CONFIG.club.legalName} yamaç paraşütü topluluk uygulaması ${APP_CONFIG.name}'te hesap açtı ve onayınızı istiyor.`,
      `Bilgileri okumak ve onay vermek için (7 gün geçerli): ${link}`,
      '',
      `Hello ${parsed.data.guardian_name},`,
      '',
      `Your child created an account on ${APP_CONFIG.name}, the paragliding community app of ${APP_CONFIG.club.legalName}, and needs your consent.`,
      `Read the details and confirm here (valid for 7 days): ${link}`,
      '',
      `${APP_CONFIG.club.legalName} · ${APP_CONFIG.club.email}`,
    ].join('\n'),
  });
  return { ok: true, values: { email: parsed.data.guardian_email } };
}

export async function confirmGuardian(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = String(formData.get('token') ?? '');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('confirm_guardian_consent', { p_token: token });
  if (error || !data) return { error: 'linkInvalid' };
  return { ok: true };
}
