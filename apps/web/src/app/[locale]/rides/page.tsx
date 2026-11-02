import { redirect } from '@/i18n/navigation';

/** The carpool board became the transport category of the notice board. */
export default async function RidesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: '/notices?category=transport', locale });
}
