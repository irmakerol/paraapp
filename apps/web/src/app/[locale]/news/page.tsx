import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { APP_CONFIG } from '@paraapp/core';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { publicUrl } from '@/lib/storage';
import { formatDate } from '@/lib/format';
import { Card, PageTitle } from '@/components/ui';
import { Pagination } from '@/components/pagination';

const PAGE_SIZE = 12;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'news' });
  return { title: t('title'), description: t('lead', { club: APP_CONFIG.club.legalName }) };
}

export default async function NewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('news');
  const common = await getTranslations('common');
  const page = Math.max(1, Math.min(500, Number((await searchParams).page) || 1));

  const supabase = await createClient();
  const { data } = await supabase
    .from('news')
    .select('id, slug, title, summary, cover_path, published_at, pinned, members_only, tags')
    .order('pinned', { ascending: false })
    .order('published_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const items = (data ?? []).slice(0, PAGE_SIZE);

  return (
    <>
      <PageTitle lead={t('lead', { club: APP_CONFIG.club.legalName })}>{t('title')}</PageTitle>
      {items.length === 0 ? (
        <Card>
          <p className="text-muted">{t('noNews')}</p>
        </Card>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((n) => {
            const cover = publicUrl('content', n.cover_path);
            return (
              <li key={n.id}>
                <Link
                  href={`/news/${n.slug}`}
                  className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:shadow-md"
                >
                  {cover ? (
                    <Image
                      src={cover}
                      alt=""
                      width={640}
                      height={360}
                      className="aspect-video w-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="aspect-video w-full bg-gradient-to-br from-brand-navy to-brand-blue" />
                  )}
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      {n.pinned ? (
                        <span className="rounded-full bg-brand-yellow/30 px-2 py-0.5">
                          {common('pinned')}
                        </span>
                      ) : null}
                      {n.members_only ? (
                        <span className="rounded-full bg-brand-orange/20 px-2 py-0.5">
                          {common('membersOnly')}
                        </span>
                      ) : null}
                    </div>
                    <h2 className="text-lg font-bold leading-snug">{n.title}</h2>
                    {n.summary ? <p className="text-sm text-muted">{n.summary}</p> : null}
                    <p className="mt-auto pt-2 text-xs text-muted">
                      {n.published_at ? formatDate(n.published_at, locale) : null}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination
        pathname="/news"
        params={{}}
        page={page}
        hasNext={(data ?? []).length > PAGE_SIZE}
      />
    </>
  );
}
