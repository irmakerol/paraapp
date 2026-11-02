import { CONFIG } from './config';
import { locale } from './i18n';
import { supabase } from './supabase';

// Same order as the website's `nextOnboardingStep` (apps/web/src/lib/onboarding.ts).
export type OnboardingStep = 'age' | 'legal' | 'consents' | 'guardian';

export const SIGNUP_CONSENTS = ['marketing_notifications', 'analytics', 'public_profile'] as const;
export type SignupConsent = (typeof SIGNUP_CONSENTS)[number];

export async function onboardingStep(userId: string): Promise<OnboardingStep | null> {
  const [{ data: profile, error }, { data: pending }, { count }] = await Promise.all([
    supabase.from('profiles').select('status, display_name').eq('id', userId).maybeSingle(),
    supabase.rpc('pending_legal_kinds'),
    supabase.from('consents').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);
  if (error || !profile) throw new Error('profile');
  const status = (profile as { status: string }).status;
  if (status === 'onboarding') return 'age';
  if (Array.isArray(pending) && pending.length > 0) return 'legal';
  if (!count) return 'consents';
  if (status === 'pending_guardian') return 'guardian';
  return null;
}

export type AgeResult = 'ok' | 'invalidDate' | 'tooYoung' | 'generic';

export async function submitBirthDate(isoDate: string): Promise<AgeResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return 'generic';
  try {
    const res = await fetch(`${CONFIG.webUrl}/api/mobile/age`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ birth_date: isoDate }),
    });
    const body = (await res.json()) as { ok: boolean; error?: string };
    if (body.ok) return 'ok';
    if (body.error === 'tooYoung') {
      await supabase.auth.signOut({ scope: 'local' });
      return 'tooYoung';
    }
    return body.error === 'invalidDate' ? 'invalidDate' : 'generic';
  } catch {
    return 'generic';
  }
}

async function latestDocument(kind: string): Promise<string | null> {
  const { data } = await supabase
    .from('legal_documents')
    .select('id')
    .eq('kind', kind)
    .eq('locale', locale)
    .not('published_at', 'is', null)
    .lte('published_at', new Date().toISOString())
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

export async function acceptLegal(userId: string): Promise<boolean> {
  const ids = (
    await Promise.all([latestDocument('privacy_notice'), latestDocument('terms')])
  ).filter((id): id is string => Boolean(id));
  const { error } = await supabase.from('legal_acceptances').upsert(
    ids.map((document_id) => ({ user_id: userId, document_id })),
    { onConflict: 'user_id,document_id', ignoreDuplicates: true },
  );
  return !error;
}

export async function saveConsents(
  userId: string,
  choices: Record<SignupConsent, boolean>,
): Promise<boolean> {
  const documentId = await latestDocument('explicit_consent');
  const { error } = await supabase.from('consents').insert(
    SIGNUP_CONSENTS.map((consent_type) => ({
      user_id: userId,
      consent_type,
      granted: choices[consent_type],
      document_id: documentId,
      method: 'signup',
    })),
  );
  return !error;
}

export const legalUrl = (kind: 'privacy_notice' | 'terms' | 'explicit_consent') =>
  `${CONFIG.webUrl}/${locale}/legal/${kind}`;
