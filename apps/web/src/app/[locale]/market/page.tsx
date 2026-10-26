import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AD_CATEGORIES, CURRENCIES, parseAdFilters } from '@paraapp/core';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { AD_LIST_COLUMNS } from '@/lib/ads';
import { Alert, Button, buttonClass, Card, Field, Input, PageTitle, Select } from '@/components/ui';
import { Pagination } from '@/components/pagination';
import { AdCard } from '@/components/ad-card';

const PAGE_SIZE = 24;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'market' });
  return { title: t('title'), description: t('lead') };
}

export default async function MarketPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('market');
  const common = await getTranslations('common');
  const filters = parseAdFilters(await searchParams);
  const page = filters.page ?? 1;

  const supabase = await createClient();
  let query = supabase
    .from('ads')
    .select(AD_LIST_COLUMNS)
    .in('status', ['active', 'reserved'])
    .is('removed_at', null)
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  if (filters.q)
    query = query.textSearch('search', filters.q, { type: 'websearch', config: 'simple' });
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.brand) query = query.ilike('brand', `%${escapeLike(filters.brand)}%`);
  if (filters.size) query = query.ilike('size', escapeLike(filters.size));
  if (filters.certification)
    query = query.ilike('certification', `%${escapeLike(filters.certification)}%`);
  if (filters.city) query = query.ilike('city', `%${escapeLike(filters.city)}%`);
  if (filters.currency) query = query.eq('currency', filters.currency);
  if (filters.min !== undefined) query = query.gte('price', filters.min);
  if (filters.max !== undefined) query = query.lte('price', filters.max);

  const [{ data }, viewer] = await Promise.all([query, getViewer()]);
  const ads = (data ?? []).slice(0, PAGE_SIZE);
  const keep: Record<string, string | undefined> = Object.fromEntries(
    Object.entries(filters)
      .filter(([k]) => k !== 'page')
      .map(([k, v]) => [k, v === undefined ? undefined : String(v)]),
  );

  return (
    <>
      <PageTitle lead={t('lead')}>{t('title')}</PageTitle>
      {viewer ? (
        <div className="mb-6 flex flex-wrap gap-2">
          <Link href="/market/new" className={buttonClass('primary')}>
            {t('newAd')}
          </Link>
          <Link href="/market/mine" className={buttonClass('secondary')}>
            {t('myAds')}
          </Link>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <aside>
          <Card className="lg:sticky lg:top-20">
            <form method="get" className="space-y-4" role="search">
              <Field id="q" label={t('filters.q')}>
                <Input id="q" name="q" type="search" defaultValue={filters.q} maxLength={100} />
              </Field>
              <Field id="category" label={t('filters.category')}>
                <Select id="category" name="category" defaultValue={filters.category ?? ''}>
                  <option value="">{t('filters.any')}</option>
                  {AD_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {t(`categories.${c}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field id="brand" label={t('filters.brand')}>
                  <Input id="brand" name="brand" defaultValue={filters.brand} maxLength={60} />
                </Field>
                <Field id="size" label={t('filters.size')}>
                  <Input id="size" name="size" defaultValue={filters.size} maxLength={20} />
                </Field>
                <Field id="certification" label={t('filters.certification')}>
                  <Input
                    id="certification"
                    name="certification"
                    defaultValue={filters.certification}
                    maxLength={20}
                    placeholder="EN-B"
                  />
                </Field>
                <Field id="city" label={t('filters.city')}>
                  <Input id="city" name="city" defaultValue={filters.city} maxLength={80} />
                </Field>
                <Field id="min" label={t('filters.min')}>
                  <Input
                    id="min"
                    name="min"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    defaultValue={filters.min}
                  />
                </Field>
                <Field id="max" label={t('filters.max')}>
                  <Input
                    id="max"
                    name="max"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    defaultValue={filters.max}
                  />
                </Field>
              </div>
              <Field id="currency" label={t('filters.currency')}>
                <Select id="currency" name="currency" defaultValue={filters.currency ?? ''}>
                  <option value="">{t('filters.any')}</option>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="flex gap-2">
                <Button type="submit">{t('filters.apply')}</Button>
                <Link href="/market" className={buttonClass('ghost')}>
                  {common('clear')}
                </Link>
              </div>
            </form>
          </Card>
        </aside>

        <div className="space-y-4">
          <Alert>{t('disclaimer')}</Alert>
          {ads.length === 0 ? (
            <Card>
              <p className="text-muted">{t('noAds')}</p>
            </Card>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {ads.map((ad) => (
                <li key={ad.id}>
                  <AdCard ad={ad} locale={locale} />
                </li>
              ))}
            </ul>
          )}
          <Pagination
            pathname="/market"
            params={keep}
            page={page}
            hasNext={(data ?? []).length > PAGE_SIZE}
          />
        </div>
      </div>
    </>
  );
}

/** Escapes % and _ so user input is matched literally in ILIKE. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
