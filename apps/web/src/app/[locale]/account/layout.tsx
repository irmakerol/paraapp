import { getTranslations } from 'next-intl/server';
import { requireActiveViewer } from '@/lib/session';
import { PageTitle } from '@/components/ui';
import { Tabs } from '@/components/tabs';

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
  const notifications = await getTranslations({ locale, namespace: 'notificationsSettings' });
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle>{t('title')}</PageTitle>
      <Tabs
        tabs={[
          { href: '/account', label: t('tabs.profile') },
          { href: '/account/notifications', label: notifications('tab') },
          { href: '/account/privacy', label: t('tabs.privacy') },
        ]}
      />
      <div className="mt-6">{children}</div>
    </div>
  );
}
