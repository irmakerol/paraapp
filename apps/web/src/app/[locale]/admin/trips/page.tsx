import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/staff';
import { formatDateRange } from '@/lib/trips';
import { buttonClass } from '@/components/ui';

export default async function AdminTripsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale, 'trips');
  const t = await getTranslations('admin.tripsAdmin');
  const supabase = await createClient();
  const { data: trips } = await supabase
    .from('trips')
    .select('id, title, status, starts_on, ends_on, max_pilots')
    .order('starts_on', { ascending: false })
    .limit(200);
  const counts = await Promise.all(
    (trips ?? []).map((trip) =>
      supabase.rpc('trip_counts', { p_trip: trip.id }).then((r) => r.data?.[0]),
    ),
  );
  return (
    <div className="space-y-6">
      <Link href="/admin/trips/new" className={buttonClass('primary')}>
        {t('new')}
      </Link>
      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {(trips ?? []).map((trip, i) => {
          const c = counts[i];
          return (
            <li key={trip.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Link
                href={`/admin/trips/${trip.id}`}
                className="flex-1 font-semibold hover:underline"
              >
                {trip.title}
              </Link>
              <span className="text-xs text-muted">
                {t(`statuses.${trip.status}`)} ·{' '}
                {formatDateRange(trip.starts_on, trip.ends_on, locale)} ·{' '}
                {t('listCounts', {
                  taken: Number(c?.seats_taken ?? 0),
                  max: trip.max_pilots,
                  pending: Number(c?.pending ?? 0),
                  waitlisted: Number(c?.waitlisted ?? 0),
                  interested: Number(c?.interested ?? 0),
                })}
              </span>
            </li>
          );
        })}
        {!trips?.length && <li className="px-4 py-3 text-sm text-muted">{t('empty')}</li>}
      </ul>
    </div>
  );
}
