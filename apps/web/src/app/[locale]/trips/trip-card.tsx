import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { publicUrl } from '@/lib/storage';
import { formatPrice } from '@/lib/format';
import { formatDateRange, tripDestination, type Trip } from '@/lib/trips';

export async function TripCard({
  trip,
  locale,
  badge,
}: {
  trip: Pick<
    Trip,
    | 'slug'
    | 'title'
    | 'summary'
    | 'cover_path'
    | 'starts_on'
    | 'ends_on'
    | 'destination_country'
    | 'destination_region'
    | 'price_amount'
    | 'price_currency'
    | 'status'
    | 'members_only'
    | 'min_pilot_level'
  >;
  locale: string;
  badge?: string;
}) {
  const t = await getTranslations('trips');
  const levels = await getTranslations('account.profile.levels');
  const cover = publicUrl('content', trip.cover_path);
  const destination = tripDestination(trip, locale);
  return (
    <Link
      href={`/trips/${trip.slug}`}
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card hover:shadow-md"
    >
      <div className="relative aspect-[16/9] bg-background">
        {cover ? (
          <Image
            src={cover}
            alt=""
            fill
            sizes="(min-width: 768px) 33vw, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl" aria-hidden>
            🪂
          </div>
        )}
        {badge ? (
          <span className="absolute left-3 top-3 rounded-full bg-card px-3 py-1 text-xs font-bold">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-5">
        <p className="text-xs font-semibold uppercase text-muted">
          {destination ?? t('trip')}
          {trip.members_only ? ` · ${t('membersOnly')}` : ''}
        </p>
        <p className={`text-lg font-bold ${trip.status === 'cancelled' ? 'line-through' : ''}`}>
          {trip.title}
        </p>
        <p className="text-sm">{formatDateRange(trip.starts_on, trip.ends_on, locale)}</p>
        {trip.summary ? <p className="text-sm text-muted">{trip.summary}</p> : null}
        <p className="mt-auto pt-2 text-sm font-semibold">
          {trip.price_amount != null
            ? formatPrice(trip.price_amount, trip.price_currency, locale)
            : t('priceTbd')}
          {trip.min_pilot_level
            ? ` · ${t('minLevelShort', { level: levels(trip.min_pilot_level) })}`
            : ''}
        </p>
        {trip.status === 'cancelled' ? (
          <p className="text-sm font-bold text-brand-red">{t('cancelled')}</p>
        ) : null}
      </div>
    </Link>
  );
}
