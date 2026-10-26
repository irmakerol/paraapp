import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { requireViewer } from '@/lib/session';
import { Card, PageTitle } from '@/components/ui';
import { AgeForm } from '../forms';

export default async function AgePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await requireViewer(locale);
  if (viewer.profile.status !== 'onboarding') return redirect({ href: '/onboarding', locale });
  const t = await getTranslations('onboarding.age');
  return (
    <div className="mx-auto max-w-md">
      <PageTitle lead={t('text')}>{t('title')}</PageTitle>
      <Card>
        <AgeForm />
      </Card>
    </div>
  );
}
