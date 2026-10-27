import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requireActiveViewer } from '@/lib/session';
import { canUse } from '@/lib/staff';
import { getTrip } from '@/lib/trips';
import { PageTitle } from '@/components/ui';
import { Participants } from '../../../admin/trips/participants';

export const metadata: Metadata = { robots: { index: false } };

/** The participant list for a trip's guides (organisers use the admin area). */
export default async function TripParticipantsPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const viewer = await requireActiveViewer(locale);
  const trip = await getTrip(slug);
  if (!trip) notFound();
  const isGuide = trip.guides.some((g) => g.id === viewer.user.id);
  if (!isGuide && !canUse(viewer, 'trips')) notFound();
  const t = await getTranslations('admin.tripsAdmin');
  return (
    <div className="space-y-6">
      <Link href={`/trips/${trip.slug}`} className="text-sm text-muted hover:underline">
        ← {trip.title}
      </Link>
      <PageTitle>{t('participants')}</PageTitle>
      <Participants tripId={trip.id} locale={locale} maxPilots={trip.max_pilots} />
    </div>
  );
}
