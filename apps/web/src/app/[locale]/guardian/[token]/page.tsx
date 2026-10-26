import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { APP_CONFIG } from '@paraapp/core';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { Alert, Card, PageTitle } from '@/components/ui';
import { GuardianConfirmForm } from './confirm-form';

export const metadata: Metadata = { robots: { index: false } };

export default async function GuardianConfirmPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('guardianConfirm');
  const supabase = await createClient();
  const { data } = await supabase.rpc('guardian_request_info', { p_token: token });
  const info = data?.[0];

  return (
    <div className="mx-auto max-w-xl">
      <PageTitle>{t('title')}</PageTitle>
      <Card className="space-y-4">
        {!info || info.confirmed ? (
          <Alert tone={info?.confirmed ? 'success' : 'error'}>
            {info?.confirmed ? t('confirmed') : t('invalid')}
          </Alert>
        ) : (
          <>
            <p>
              {t('intro', {
                guardian: info.guardian_name,
                name: info.display_name,
                app: APP_CONFIG.name,
                club: APP_CONFIG.club.legalName,
              })}
            </p>
            <p className="text-muted">{t('what', { email: APP_CONFIG.club.email })}</p>
            <Link href="/legal/privacy_notice" target="_blank" className="block underline">
              {t('privacyLink')}
            </Link>
            <GuardianConfirmForm token={token} />
          </>
        )}
      </Card>
    </div>
  );
}
