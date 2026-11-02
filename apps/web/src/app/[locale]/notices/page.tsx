import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { NOTICE_CATEGORIES, NOTICE_KINDS, parseNoticeFilters } from '@paraapp/core';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { listSites } from '@/lib/sites';
import { displayNames } from '@/lib/people';
import { AD_LIST_COLUMNS } from '@/lib/ads';
import { sampleLabel } from '@/lib/sample';
import { currentTime, formatDate, formatDay, formatPrice } from '@/lib/format';
import type { Database } from '@/lib/supabase/database.types';
import { Alert, Button, buttonClass, Card, Field, Input, PageTitle, Select } from '@/components/ui';
import { AdCard } from '@/components/ad-card';
import { ReportButton } from '@/components/report-button';
import { MessageButton } from '../pilots/pilot-actions';
import { NoticeForm } from './notice-form';
import { deleteNotice, updateNoticeState } from './actions';

export const metadata: Metadata = { robots: { index: false, follow: false } };

type Notice = Database['public']['Tables']['notices']['Row'] & {
  sites: { name: string } | null;
};

const MARKET_PREVIEW = 4;

export default async function NoticesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('notices');
  const filters = parseNoticeFilters(await searchParams);
  const supabase = await createClient();
  const [viewer, { data: ads }] = await Promise.all([
    getViewer(),
    supabase
      .from('ads')
      .select(AD_LIST_COLUMNS)
      .eq('status', 'active')
      .is('removed_at', null)
      .order('created_at', { ascending: false })
      .limit(MARKET_PREVIEW),
  ]);
  const adult = viewer?.profile.age_group === 'adult';

  return (
    <div className="space-y-10">
      <PageTitle lead={t('lead')}>{t('title')}</PageTitle>

      {/* The gear market keeps its own pages; this section makes it the first thing people see. */}
      <section
        aria-labelledby="market-heading"
        className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm"
      >
        <div className="flex flex-wrap items-end justify-between gap-4 bg-brand-navy px-5 py-5 text-white sm:px-6">
          <div>
            <h2 id="market-heading" className="text-2xl font-extrabold">
              {t('marketTitle')}
            </h2>
            <p className="mt-1 text-white/85">{t('marketLead')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/market"
              className="inline-flex min-h-11 items-center rounded-lg bg-white px-4 font-semibold text-brand-navy"
            >
              {t('marketAll')}
            </Link>
            {viewer ? (
              <Link
                href="/market/new"
                className="inline-flex min-h-11 items-center rounded-lg border border-white/70 px-4 font-semibold text-white"
              >
                {t('marketNew')}
              </Link>
            ) : null}
          </div>
        </div>
        <div className="p-5 sm:p-6">
          {ads?.length ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {ads.map((ad) => (
                <li key={ad.id}>
                  <AdCard ad={ad} locale={locale} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">{t('marketEmpty')}</p>
          )}
        </div>
      </section>

      <section aria-labelledby="board-heading" className="space-y-5">
        <div>
          <h2 id="board-heading" className="text-2xl font-extrabold">
            {t('boardTitle')}
          </h2>
          <p className="mt-1 text-muted">{t('boardLead')}</p>
        </div>
        {!viewer ? (
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <p>{t('signInForBoard')}</p>
            <Link href="/auth/sign-in" className={buttonClass('primary')}>
              {t('signIn')}
            </Link>
          </Card>
        ) : !adult ? (
          <Alert>{t('adultsOnly')}</Alert>
        ) : (
          <Board locale={locale} userId={viewer.user.id} filters={filters} />
        )}
      </section>
    </div>
  );
}

async function Board({
  locale,
  userId,
  filters,
}: {
  locale: string;
  userId: string;
  filters: ReturnType<typeof parseNoticeFilters>;
}) {
  const t = await getTranslations('notices');
  const supabase = await createClient();
  const nowIso = new Date(currentTime()).toISOString();

  let query = supabase
    .from('notices')
    .select('*, sites:site_id(name)')
    .eq('closed', false)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(200);
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.kind) query = query.eq('kind', filters.kind);
  if (filters.site) query = query.eq('site_id', filters.site);
  if (filters.date) query = query.eq('notice_date', filters.date);

  const [{ data: open }, { data: inactive }, sites] = await Promise.all([
    query.returns<Notice[]>(),
    supabase
      .from('notices')
      .select('*, sites:site_id(name)')
      .eq('user_id', userId)
      .or(`closed.eq.true,expires_at.lte.${nowIso}`)
      .order('created_at', { ascending: false })
      .returns<Notice[]>(),
    listSites(),
  ]);
  const notices = open ?? [];
  const mine = inactive ?? [];
  const all = [...notices, ...mine];
  const names = await displayNames(
    supabase,
    all.map((n) => n.user_id),
  );
  const paths = all.map((n) => n.photo_path).filter((p): p is string => Boolean(p));
  const photos = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage
      .from('notice-photos')
      .createSignedUrls(paths, 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) photos.set(s.path, s.signedUrl);
  }
  const siteOptions = sites.map((s) => ({ id: s.id, name: sampleLabel(s.name, locale) }));

  const chip = (category: string | undefined) => {
    const query = new URLSearchParams();
    if (category) query.set('category', category);
    if (filters.kind) query.set('kind', filters.kind);
    if (filters.site) query.set('site', filters.site);
    if (filters.date) query.set('date', filters.date);
    const qs = query.toString();
    return qs ? `/notices?${qs}` : '/notices';
  };

  const card = (n: Notice) => (
    <NoticeCard
      key={n.id}
      notice={n}
      locale={locale}
      mine={n.user_id === userId}
      author={names.get(n.user_id) ?? '—'}
      photo={n.photo_path ? photos.get(n.photo_path) : undefined}
    />
  );

  return (
    <>
      <details className="rounded-2xl border border-border bg-card p-4">
        <summary className="cursor-pointer font-semibold">{t('new')}</summary>
        <div className="mt-4">
          <NoticeForm sites={siteOptions} />
        </div>
      </details>

      <nav aria-label={t('filter')} className="flex flex-wrap gap-2">
        {[undefined, ...NOTICE_CATEGORIES].map((c) => {
          const active = filters.category === c;
          return (
            <Link
              key={c ?? 'all'}
              href={chip(c)}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm ${
                active ? 'border-brand-navy bg-brand-navy text-white' : 'border-border bg-card'
              }`}
            >
              {c ? t(`categories.${c}`) : t('all')}
            </Link>
          );
        })}
      </nav>
      <form method="get" className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        {filters.category ? <input type="hidden" name="category" value={filters.category} /> : null}
        <Field id="f-kind" label={t('fields.kind')}>
          <Select id="f-kind" name="kind" defaultValue={filters.kind ?? ''}>
            <option value="">{t('all')}</option>
            {NOTICE_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`kinds.${k}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="f-site" label={t('fields.site')}>
          <Select id="f-site" name="site" defaultValue={filters.site ?? ''}>
            <option value="">{t('anySite')}</option>
            {siteOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="f-date" label={t('fields.date')}>
          <Input id="f-date" name="date" type="date" defaultValue={filters.date} />
        </Field>
        <div className="flex gap-2">
          <Button variant="secondary">{t('apply')}</Button>
          {filters.kind || filters.site || filters.date || filters.category ? (
            <Link href="/notices" className={buttonClass('ghost')}>
              {t('clear')}
            </Link>
          ) : null}
        </div>
      </form>

      {notices.length ? (
        <ul className="grid gap-4 lg:grid-cols-2">{notices.map(card)}</ul>
      ) : (
        <p className="text-muted">{t('empty')}</p>
      )}

      {mine.length ? (
        <section aria-labelledby="mine-heading" className="space-y-3">
          <h3 id="mine-heading" className="text-lg font-bold">
            {t('mine')}
          </h3>
          <p className="text-sm text-muted">{t('mineLead')}</p>
          <ul className="grid gap-4 lg:grid-cols-2">{mine.map(card)}</ul>
        </section>
      ) : null}
    </>
  );
}

async function NoticeCard({
  notice: n,
  locale,
  mine,
  author,
  photo,
}: {
  notice: Notice;
  locale: string;
  mine: boolean;
  author: string;
  photo: string | undefined;
}) {
  const t = await getTranslations('notices');
  const common = await getTranslations('common');
  const expired = new Date(n.expires_at).getTime() <= currentTime();
  const inactive = n.closed || expired;
  const title = sampleLabel(n.title, locale);
  const meta = [
    n.notice_date ? formatDay(n.notice_date, locale) : null,
    [n.sites?.name ? sampleLabel(n.sites.name, locale) : null, n.place_text]
      .filter(Boolean)
      .join(', ') || null,
    n.seats != null ? t('seatsCount', { count: n.seats }) : null,
    n.price != null ? formatPrice(Number(n.price), n.currency ?? 'TRY', locale) : null,
  ].filter(Boolean);

  return (
    <li>
      <Card className={`flex h-full gap-4 ${inactive ? 'opacity-70' : ''}`}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
          <img
            src={photo}
            alt={t('photoAlt', { title })}
            className="size-24 shrink-0 rounded-xl object-cover sm:size-28"
            loading="lazy"
          />
        ) : null}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                n.kind === 'offer'
                  ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100'
                  : 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100'
              }`}
            >
              {t(`kindsShort.${n.kind}`)}
            </span>
            <span className="rounded-full border border-border px-2 py-0.5 text-xs">
              {t(`categories.${n.category}`)}
            </span>
            {n.closed ? <span className="text-xs font-semibold">{t('closed')}</span> : null}
            {!n.closed && expired ? (
              <span className="text-xs font-semibold">{t('expired')}</span>
            ) : null}
          </div>
          <h4 className="font-bold leading-snug">{title}</h4>
          {meta.length ? <p className="text-sm font-medium">{meta.join(' · ')}</p> : null}
          {n.body ? <p className="whitespace-pre-line text-sm">{n.body}</p> : null}
          <p className="text-sm text-muted">
            {mine ? (
              <>
                {t('yours')}
                {!inactive ? ` · ${t('expires', { date: formatDate(n.expires_at, locale) })}` : ''}
              </>
            ) : (
              <Link href={`/pilots/${n.user_id}`} className="hover:underline">
                {author}
              </Link>
            )}
          </p>
          <div className="flex flex-wrap items-start gap-2">
            {mine ? (
              <>
                {inactive ? (
                  <StateButton id={n.id} op="renew" label={t('renew')} />
                ) : (
                  <>
                    <StateButton id={n.id} op="renew" label={t('renew')} />
                    <StateButton id={n.id} op="close" label={t('close')} />
                  </>
                )}
                <form action={deleteNotice}>
                  <input type="hidden" name="id" value={n.id} />
                  <Button variant="danger">{common('delete')}</Button>
                </form>
              </>
            ) : (
              <>
                {!inactive ? <MessageButton userId={n.user_id} /> : null}
                <ReportButton targetType="notice" targetId={n.id} />
              </>
            )}
          </div>
        </div>
      </Card>
    </li>
  );
}

function StateButton({ id, op, label }: { id: string; op: string; label: string }) {
  return (
    <form action={updateNoticeState}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="op" value={op} />
      <Button variant="secondary">{label}</Button>
    </form>
  );
}
