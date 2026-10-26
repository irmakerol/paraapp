import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Card, PageTitle } from '@/components/ui';

export default async function CheckEmailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { locale } = await params;
  const { email } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('auth');
  return (
    <div className="mx-auto max-w-md">
      <PageTitle>{t('checkEmailTitle')}</PageTitle>
      <Card>
        <p>{t('checkEmailText', { email: email ?? '' })}</p>
      </Card>
    </div>
  );
}
