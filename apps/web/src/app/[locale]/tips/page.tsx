import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DIFFICULTIES, TIP_CATEGORIES, type Difficulty, type TipCategory } from '@paraapp/core';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { buttonClass, Card, PageTitle } from '@/components/ui';
import { Pagination } from '@/components/pagination';
import { TipCard } from '@/components/tip-card';

const PAGE_SIZE = 18;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'tips' });
  return { title: t('title'), description: t('lead') };
}

export default async function TipsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string; level?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('tips');
  const sp = await searchParams;
  const category = TIP_CATEGORIES.includes(sp.category as TipCategory)
    ? (sp.category as TipCategory)
    : undefined;
  const level = DIFFICULTIES.includes(sp.level as Difficulty)
    ? (sp.level as Difficulty)
    : undefined;
  const page = Math.max(1, Math.min(500, Number(sp.page) || 1));

  const supabase = await createClient();
  let query = supabase
    .from('tips')
    .select('slug, title, summary, category, difficulty, video_url')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  if (category) query = query.eq('category', category);
  if (level) query = query.eq('difficulty', level);
  const [{ data }, viewer] = await Promise.all([query, getViewer()]);
  const items = (data ?? []).slice(0, PAGE_SIZE);

  const chip = (label: string, query: Record<string, string>, active: boolean) => (
    <Link
      href={{ pathname: '/tips', query }}
      aria-current={active ? 'true' : undefined}
      className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium ${
        active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'
      }`}
    >
      {label}
    </Link>
  );
  const withLevel: Record<string, string> = level ? { level } : {};
  const withCategory: Record<string, string> = category ? { category } : {};

  return (
    <>
      <PageTitle lead={t('lead')}>{t('title')}</PageTitle>
      <div className="mb-6 flex flex-wrap gap-2">
        {viewer ? (
          <>
            <Link href="/tips/suggest" className={buttonClass('primary')}>
              {t('suggest')}
            </Link>
            <Link href="/tips/saved" className={buttonClass('secondary')}>
              {t('saved')}
            </Link>
          </>
        ) : null}
      </div>
      <nav className="mb-3 flex gap-2 overflow-x-auto pb-1" aria-label={t('fields.category')}>
        {chip(t('allCategories'), withLevel, !category)}
        {TIP_CATEGORIES.map((c) =>
          chip(t(`categories.${c}`), { ...withLevel, category: c }, category === c),
        )}
      </nav>
      <nav className="mb-6 flex gap-2 overflow-x-auto pb-1" aria-label={t('fields.difficulty')}>
        {chip(t('allLevels'), withCategory, !level)}
        {DIFFICULTIES.map((d) =>
          chip(t(`difficulty.${d}`), { ...withCategory, level: d }, level === d),
        )}
      </nav>
      {items.length === 0 ? (
        <Card>
          <p className="text-muted">{t('noTips')}</p>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((tip) => (
            <li key={tip.slug}>
              <TipCard tip={tip} />
            </li>
          ))}
        </ul>
      )}
      <Pagination
        pathname="/tips"
        params={{ category, level }}
        page={page}
        hasNext={(data ?? []).length > PAGE_SIZE}
      />
      <p className="mt-8 text-sm text-muted">{t('safety')}</p>
    </>
  );
}
