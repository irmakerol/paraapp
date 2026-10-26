import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Card, PageTitle } from '@/components/ui';
import { ForgotPasswordForm } from '../forms';

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth');
  return (
    <div className="mx-auto max-w-md">
      <PageTitle lead={t('forgotText')}>{t('forgotTitle')}</PageTitle>
      <Card>
        <ForgotPasswordForm />
      </Card>
    </div>
  );
}
