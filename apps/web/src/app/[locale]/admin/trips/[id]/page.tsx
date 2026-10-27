import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { canUse, requireStaff } from '@/lib/staff';
import { tripExtras } from '@/lib/trips';
import { Button, Card } from '@/components/ui';
import { TripForm } from '../trip-form';
import { tripFormOptions, tripValues } from '../options';
import { Participants } from '../participants';
import { announceTrip, deleteTrip } from '../actions';

export default async function EditTripPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const viewer = await requireStaff(locale, 'trips');
  if (!z.string().uuid().safeParse(id).success) notFound();
  const t = await getTranslations('admin.tripsAdmin');
  const common = await getTranslations('common');
  const supabase = await createClient();
  const { data: trip } = await supabase.from('trips').select('*').eq('id', id).maybeSingle();
  if (!trip) notFound();
  const [{ sites, guides }, options] = await Promise.all([tripExtras(trip.id), tripFormOptions()]);
  // Guides chosen earlier stay in the pick list even if they are no longer members.
  const people = [
    ...options.people,
    ...guides
      .filter((g) => !options.people.some((p) => p.id === g.id))
      .map((g) => ({ id: g.id, name: g.name ?? '—' })),
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">{trip.title}</h2>
        <Link href={`/trips/${trip.slug}`} className="text-sm underline">
          /trips/{trip.slug}
        </Link>
      </div>

      <Participants tripId={trip.id} locale={locale} maxPilots={trip.max_pilots} />

      {canUse(viewer, 'news') ? (
        <Card className="space-y-2">
          <h3 className="text-lg font-bold">{t('announce')}</h3>
          <p className="text-sm text-muted">
            {trip.news_id ? t('announcedHelp') : t('announceHelp')}
          </p>
          <form action={announceTrip}>
            <input type="hidden" name="trip_id" value={trip.id} />
            <input type="hidden" name="locale" value={locale} />
            <Button variant="secondary">
              {trip.news_id ? t('openAnnouncement') : t('announce')}
            </Button>
          </form>
        </Card>
      ) : null}

      <h3 className="text-lg font-bold">{t('edit')}</h3>
      <TripForm
        id={trip.id}
        values={tripValues(
          trip,
          sites.map((s) => s.id),
          guides.map((g) => ({ id: g.id, role: g.role ?? '' })),
        )}
        sites={options.sites}
        people={people}
      />

      <details className="border-t border-border pt-4">
        <summary className="flex min-h-11 cursor-pointer items-center text-danger">
          {common('delete')}
        </summary>
        <form action={deleteTrip} className="mt-3 space-y-2">
          <p className="text-sm">{t('deleteConfirm')}</p>
          <input type="hidden" name="id" value={trip.id} />
          <input type="hidden" name="locale" value={locale} />
          <Button variant="danger">{common('delete')}</Button>
        </form>
      </details>
    </div>
  );
}
