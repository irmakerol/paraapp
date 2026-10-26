import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Alert, PageTitle } from '@/components/ui';

export default async function AccountDeletedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('account.privacy');
  return (
    <div className="mx-auto max-w-md">
      <PageTitle>{t('deleteTitle')}</PageTitle>
      <Alert tone="success">{t('deleted')}</Alert>
    </div>
  );
}
