import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireViewer } from '@/lib/session';
import { Card, PageTitle } from '@/components/ui';
import { ResetPasswordForm } from '../forms';

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireViewer(locale);
  const t = await getTranslations('auth');
  return (
    <div className="mx-auto max-w-md">
      <PageTitle>{t('resetTitle')}</PageTitle>
      <Card>
        <ResetPasswordForm />
      </Card>
    </div>
  );
}
