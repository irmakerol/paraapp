import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SIGNUP_CONSENTS } from '@paraapp/core';
import { requireViewer } from '@/lib/session';
import { getLatestLegalDocument } from '@/lib/legal';
import { Link } from '@/i18n/navigation';
import { Card, PageTitle } from '@/components/ui';
import { ConsentsForm } from '../forms';

export default async function ConsentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireViewer(locale);
  const t = await getTranslations();
  const doc = await getLatestLegalDocument('explicit_consent', locale);
  const items = SIGNUP_CONSENTS.map((type) => ({
    type,
    title: t(`consentTypes.${type}.title`),
    text: t(`consentTypes.${type}.text`),
  }));
  return (
    <div className="mx-auto max-w-xl">
      <PageTitle lead={t('onboarding.consents.intro')}>{t('onboarding.consents.title')}</PageTitle>
      <Card className="space-y-4">
        <ConsentsForm documentId={doc?.id ?? null} items={items} />
        <Link href="/legal/explicit_consent" target="_blank" className="block text-sm underline">
          {t('onboarding.consents.readText')}
        </Link>
      </Card>
    </div>
  );
}
