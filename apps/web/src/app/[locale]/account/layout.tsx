import { getTranslations } from 'next-intl/server';
import { requireActiveViewer } from '@/lib/session';
import { PageTitle } from '@/components/ui';
import { AccountTabs } from './tabs';

export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireActiveViewer(locale);
  const t = await getTranslations({ locale, namespace: 'account' });
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle>{t('title')}</PageTitle>
      <AccountTabs profileLabel={t('tabs.profile')} privacyLabel={t('tabs.privacy')} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
