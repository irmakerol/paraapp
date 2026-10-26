import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requireStaff, staffAreas } from '@/lib/staff';
import { PageTitle } from '@/components/ui';
import { Tabs } from '@/components/tabs';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const viewer = await requireStaff(locale);
  const t = await getTranslations({ locale, namespace: 'admin' });
  const areas = staffAreas(viewer);
  return (
    <div>
      <PageTitle>{t('title')}</PageTitle>
      <Tabs
        tabs={[
          { href: '/admin', label: t('dashboard') },
          ...areas.map((a) => ({ href: `/admin/${a}`, label: t(a) })),
        ]}
      />
      <div className="mt-6">{children}</div>
    </div>
  );
}
