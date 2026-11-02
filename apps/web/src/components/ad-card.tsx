import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { publicUrl } from '@/lib/storage';
import { formatPrice } from '@/lib/format';
import { coverPhoto } from '@/lib/ads';
import { sampleLabel } from '@/lib/sample';

export interface AdSummary {
  id: string;
  title: string;
  category: string;
  brand: string | null;
  size: string | null;
  certification: string | null;
  condition: string;
  price: number;
  currency: string;
  city: string | null;
  status: string;
  is_club: boolean;
  ad_photos: { path: string; position: number }[];
}

export async function AdCard({ ad, locale }: { ad: AdSummary; locale: string }) {
  const t = await getTranslations('market');
  const photo = publicUrl('ad-photos', coverPhoto(ad.ad_photos));
  return (
    <Link
      href={`/market/${ad.id}`}
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:shadow-md"
    >
      <div className="relative">
        {photo ? (
          <Image
            src={photo}
            alt=""
            width={480}
            height={360}
            className="aspect-[4/3] w-full object-cover"
            unoptimized
          />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-background text-4xl text-muted">
            <span aria-hidden>🪂</span>
          </div>
        )}
        <div className="absolute left-2 top-2 flex gap-1 text-xs font-bold">
          {ad.is_club ? (
            <span className="rounded-full bg-brand-red px-2 py-0.5 text-white">
              {t('clubBadge')}
            </span>
          ) : null}
          {ad.status !== 'active' ? (
            <span className="rounded-full bg-brand-navy px-2 py-0.5 text-white">
              {t(`statuses.${ad.status}`)}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t(`categories.${ad.category}`)}
          {ad.certification ? ` · ${ad.certification}` : ''}
          {ad.size ? ` · ${ad.size}` : ''}
        </p>
        <h2 className="font-bold leading-snug">{sampleLabel(ad.title, locale)}</h2>
        <p className="mt-auto pt-2 text-lg font-extrabold">
          {formatPrice(Number(ad.price), ad.currency, locale)}
        </p>
        <p className="text-xs text-muted">
          {t(`conditions.${ad.condition}`)}
          {ad.city ? ` · ${ad.city}` : ''}
        </p>
      </div>
    </Link>
  );
}
