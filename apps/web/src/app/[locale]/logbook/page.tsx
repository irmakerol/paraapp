import { ComingSoon } from '@/components/coming-soon';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <ComingSoon locale={locale} titleKey="logbook" />;
}
