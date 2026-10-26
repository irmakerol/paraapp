import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { requireViewer } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { Card, PageTitle } from '@/components/ui';
import { GuardianForm } from '../forms';

function requestState(r: { confirmed_at: string | null; expires_at: string }) {
  if (r.confirmed_at) return 'confirmed';
  return new Date(r.expires_at).getTime() < Date.now() ? 'expired' : 'pending';
}

export default async function GuardianPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await requireViewer(locale);
  if (viewer.profile.status !== 'pending_guardian')
    return redirect({ href: '/onboarding', locale });
  const t = await getTranslations('onboarding.guardian');
  const format = await getFormatter();
  const supabase = await createClient();
  const { data: requests } = await supabase
    .from('guardian_consents')
    .select('id, guardian_email, created_at, expires_at, confirmed_at')
    .order('created_at', { ascending: false });
  return (
    <div className="mx-auto max-w-md space-y-6">
      <PageTitle lead={t('text')}>{t('title')}</PageTitle>
      <Card>
        <GuardianForm />
      </Card>
      {requests?.length ? (
        <Card>
          <h2 className="mb-3 font-semibold">{t('history')}</h2>
          <ul className="space-y-2 text-sm">
            {requests.map((r) => (
              <li key={r.id} className="flex justify-between gap-2">
                <span>
                  {r.guardian_email} ·{' '}
                  {format.dateTime(new Date(r.created_at), { dateStyle: 'medium' })}
                </span>
                <span className="font-medium">{t(requestState(r))}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
