import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { z } from 'zod';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AD_STATUSES, needsSafetyNotice } from '@paraapp/core';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { getOnboardingStep, getViewer } from '@/lib/session';
import { displayNames } from '@/lib/people';
import { sampleLabel } from '@/lib/sample';
import { publicUrl } from '@/lib/storage';
import { formatDate, formatPrice } from '@/lib/format';
import { Alert, Button, buttonClass, Card } from '@/components/ui';
import { ReportButton } from '@/components/report-button';
import { deleteAd, renewAd, setAdStatus } from '../actions';
import { ContactSeller } from './contact';

const getAd = cache(async (id: string) => {
  if (!z.string().uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('ads')
    .select('*, ad_photos(path, position)')
    .eq('id', id)
    .maybeSingle();
  return data;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}): Promise<Metadata> {
  const { id, locale } = await params;
  const ad = await getAd(id);
  if (!ad) return {};
  const photo = publicUrl(
    'ad-photos',
    [...ad.ad_photos].sort((a, b) => a.position - b.position)[0]?.path,
  );
  const price = formatPrice(Number(ad.price), ad.currency, locale);
  return {
    title: `${sampleLabel(ad.title, locale)} – ${price}`,
    description: ad.description.slice(0, 160),
    openGraph: { images: photo ? [photo] : undefined },
  };
}

export default async function AdPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('market');
  const ad = await getAd(id);
  if (!ad) notFound();

  const supabase = await createClient();
  const viewer = await getViewer();
  const isActive = viewer ? (await getOnboardingStep(viewer)) === null : false;
  const isOwner = viewer?.user.id === ad.owner_id;
  const names = await displayNames(supabase, [ad.owner_id]);
  const photos = [...ad.ad_photos].sort((a, b) => a.position - b.position);

  const details: [string, string | number | null][] = [
    [t('fields.category'), t(`categories.${ad.category}`)],
    [t('fields.brand'), ad.brand],
    [t('fields.model'), ad.model],
    [t('fields.size'), ad.size],
    [
      t('fields.weight'),
      ad.weight_min || ad.weight_max ? `${ad.weight_min ?? '?'}–${ad.weight_max ?? '?'} kg` : null,
    ],
    [t('fields.certification'), ad.certification],
    [t('fields.year'), ad.year],
    [t('fields.hours'), ad.hours],
    [t('fields.flights'), ad.flights],
    [
      t('fields.last_check_date'),
      ad.last_check_date ? formatDate(ad.last_check_date, locale) : null,
    ],
    [
      t('fields.reserve_repack_date'),
      ad.reserve_repack_date ? formatDate(ad.reserve_repack_date, locale) : null,
    ],
    [t('fields.condition'), t(`conditions.${ad.condition}`)],
    [t('fields.city'), [ad.city, ad.location_text].filter(Boolean).join(', ') || null],
  ];

  return (
    <div className="space-y-6">
      <Link href="/market" className="text-sm text-muted hover:underline">
        ← {t('title')}
      </Link>
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {photos.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {photos.map((p, i) => (
                <li key={p.path} className={i === 0 ? 'sm:col-span-2' : undefined}>
                  <a href={publicUrl('ad-photos', p.path)!} target="_blank" rel="noopener">
                    <Image
                      src={publicUrl('ad-photos', p.path)!}
                      alt={`${ad.title} ${i + 1}`}
                      width={1200}
                      height={900}
                      className="w-full rounded-2xl object-cover"
                      unoptimized
                      priority={i === 0}
                    />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          <section>
            <h2 className="mb-3 text-xl font-bold">{t('details')}</h2>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {details
                .filter(([, v]) => v !== null && v !== '')
                .map(([label, value]) => (
                  <div
                    key={label}
                    className="flex justify-between gap-4 border-b border-border py-1.5"
                  >
                    <dt className="text-muted">{label}</dt>
                    <dd className="text-right font-medium">{value}</dd>
                  </div>
                ))}
            </dl>
          </section>
          {ad.description ? (
            <section>
              <h2 className="mb-2 text-xl font-bold">{t('fields.description')}</h2>
              <p className="whitespace-pre-line">{ad.description}</p>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card className="space-y-4">
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              {ad.is_club ? (
                <span className="rounded-full bg-brand-red px-2 py-0.5 text-white">
                  {t('clubBadge')}
                </span>
              ) : null}
              <span className="rounded-full bg-background px-2 py-0.5">
                {t(`statuses.${ad.status}`)}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold leading-tight">
              {sampleLabel(ad.title, locale)}
            </h1>
            <p className="text-3xl font-extrabold">
              {formatPrice(Number(ad.price), ad.currency, locale)}
            </p>
            <p className="text-sm text-muted">
              {t('postedOn', { date: formatDate(ad.created_at, locale) })}
              {names.get(ad.owner_id) ? ` · ${names.get(ad.owner_id)}` : ''}
            </p>

            {isOwner ? (
              <OwnerTools id={ad.id} status={ad.status} expiresAt={ad.expires_at} locale={locale} />
            ) : isActive ? (
              ad.status !== 'sold' ? (
                <ContactSeller adId={ad.id} ownerId={ad.owner_id} />
              ) : null
            ) : (
              <Link href="/auth/sign-in" className={buttonClass('primary', 'w-full')}>
                {t('contactSeller')}
              </Link>
            )}
          </Card>
          {needsSafetyNotice(ad.category) ? <Alert tone="error">{t('safetyNotice')}</Alert> : null}
          <Alert>{t('disclaimer')}</Alert>
          {viewer && !isOwner ? <ReportButton targetType="ad" targetId={ad.id} /> : null}
        </aside>
      </div>
    </div>
  );
}

async function OwnerTools({
  id,
  status,
  expiresAt,
  locale,
}: {
  id: string;
  status: string;
  expiresAt: string;
  locale: string;
}) {
  const t = await getTranslations('market');
  const common = await getTranslations('common');
  return (
    <div className="space-y-3 border-t border-border pt-4">
      <p className="text-sm font-semibold">{t('yourAd')}</p>
      <p className="text-sm text-muted">{t('expires', { date: formatDate(expiresAt, locale) })}</p>
      <div className="flex flex-wrap gap-2">
        <Link href={`/market/${id}/edit`} className={buttonClass('secondary')}>
          {common('edit')}
        </Link>
        {status !== 'sold' ? (
          <form action={renewAd}>
            <input type="hidden" name="id" value={id} />
            <Button variant="secondary">{t('renew')}</Button>
          </form>
        ) : null}
      </div>
      <form action={setAdStatus} className="flex gap-2">
        <input type="hidden" name="id" value={id} />
        <label className="sr-only" htmlFor="status">
          {t('markAs')}
        </label>
        <select
          id="status"
          name="status"
          defaultValue={status}
          className="min-h-11 flex-1 rounded-lg border border-border bg-card px-3"
        >
          {AD_STATUSES.filter((s) => s !== 'archived').map((s) => (
            <option key={s} value={s}>
              {t(`statuses.${s}`)}
            </option>
          ))}
        </select>
        <Button variant="secondary">{t('markAs')}</Button>
      </form>
      <details>
        <summary className="cursor-pointer text-sm text-danger">{common('delete')}</summary>
        <form action={deleteAd} className="mt-2 space-y-2">
          <p className="text-sm">{t('deleteConfirm')}</p>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="locale" value={locale} />
          <Button variant="danger" className="w-full">
            {common('delete')}
          </Button>
        </form>
      </details>
    </div>
  );
}
