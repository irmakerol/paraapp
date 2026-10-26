import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { videoEmbedUrl } from '@paraapp/core';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { displayNames } from '@/lib/people';
import { formatDate } from '@/lib/format';
import { Markdown } from '@/components/markdown';
import { ReportButton } from '@/components/report-button';
import { VideoEmbed } from '@/components/video-embed';
import { Alert } from '@/components/ui';
import { BookmarkButton } from './bookmark';

const getTip = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from('tips').select('*').eq('slug', slug).maybeSingle();
  return data;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const tip = await getTip((await params).slug);
  if (!tip) return {};
  return {
    title: tip.title,
    description: tip.summary ?? undefined,
    robots: tip.status === 'published' ? undefined : { index: false },
  };
}

export default async function TipPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('tips');
  const common = await getTranslations('common');
  const tip = await getTip(slug);
  if (!tip) notFound();

  const supabase = await createClient();
  const viewer = await getViewer();
  const [{ data: bookmark }, names] = await Promise.all([
    viewer
      ? supabase
          .from('tip_bookmarks')
          .select('tip_id')
          .eq('tip_id', tip.id)
          .eq('user_id', viewer.user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    displayNames(supabase, [tip.author_id]),
  ]);
  const video = videoEmbedUrl(tip.video_url);
  const author = tip.author_id ? names.get(tip.author_id) : undefined;

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-3">
        <Link href="/tips" className="text-sm text-muted hover:underline">
          ← {t('title')}
        </Link>
        {tip.status !== 'published' ? <Alert>{t(`status.${tip.status}`)}</Alert> : null}
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <Link
            href={{ pathname: '/tips', query: { category: tip.category } }}
            className="rounded-full bg-brand-blue/15 px-2 py-0.5"
          >
            {t(`categories.${tip.category}`)}
          </Link>
          <span className="rounded-full bg-brand-yellow/30 px-2 py-0.5">
            {t(`difficulty.${tip.difficulty}`)}
          </span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{tip.title}</h1>
        <p className="text-sm text-muted">
          {tip.published_at ? formatDate(tip.published_at, locale) : null}
          {author ? ` · ${common('by', { name: author })}` : null}
        </p>
        {tip.summary ? <p className="text-lg text-muted">{tip.summary}</p> : null}
      </header>
      {video ? <VideoEmbed src={video} title={tip.title} /> : null}
      <Markdown ugc>{tip.body_md}</Markdown>
      <Alert>{t('safety')}</Alert>
      <div className="flex flex-wrap items-start gap-4">
        {viewer && tip.status === 'published' ? (
          <BookmarkButton tipId={tip.id} saved={Boolean(bookmark)} />
        ) : null}
        {viewer && viewer.user.id !== tip.author_id ? (
          <ReportButton targetType="tip" targetId={tip.id} className="pt-3" />
        ) : null}
      </div>
    </article>
  );
}
