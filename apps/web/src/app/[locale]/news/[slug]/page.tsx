import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOnboardingStep, getViewer } from '@/lib/session';
import { displayNames } from '@/lib/people';
import { publicUrl } from '@/lib/storage';
import { formatDate, formatDateTime } from '@/lib/format';
import { Markdown } from '@/components/markdown';
import { ReportButton } from '@/components/report-button';
import { Alert, buttonClass, Card } from '@/components/ui';
import { CommentForm, DeleteCommentButton, LikeButton } from './interactive';

const getArticle = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from('news').select('*').eq('slug', slug).maybeSingle();
  return data;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return {};
  const cover = publicUrl('content', article.cover_path);
  return {
    title: article.title,
    description: article.summary ?? undefined,
    // Members-only articles are never indexed.
    robots: article.members_only ? { index: false } : undefined,
    openGraph: {
      type: 'article',
      title: article.title,
      description: article.summary ?? undefined,
      publishedTime: article.published_at ?? undefined,
      images: cover ? [cover] : undefined,
    },
  };
}

/** True when a published members-only article exists, without revealing its content. */
async function isLockedArticle(slug: string): Promise<boolean> {
  try {
    const { data } = await createAdminClient()
      .from('news')
      .select('id')
      .eq('slug', slug)
      .eq('status', 'published')
      .eq('members_only', true)
      .lte('published_at', new Date().toISOString())
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('news');
  const common = await getTranslations('common');
  const article = await getArticle(slug);

  if (!article) {
    if (await isLockedArticle(slug)) {
      return (
        <Card className="mx-auto max-w-xl space-y-4">
          <p className="font-semibold">{t('membersOnlyLocked')}</p>
          <Link href="/auth/sign-in" className={buttonClass('primary')}>
            {common('signInToContinue')}
          </Link>
        </Card>
      );
    }
    notFound();
  }

  const supabase = await createClient();
  const viewer = await getViewer();
  const isActive = viewer ? (await getOnboardingStep(viewer)) === null : false;
  const isModerator = viewer?.roles.some((r) => r === 'moderator' || r === 'admin') ?? false;

  const [{ count: likeCount }, { data: myLike }, { data: comments }] = await Promise.all([
    supabase
      .from('news_likes')
      .select('news_id', { count: 'exact', head: true })
      .eq('news_id', article.id),
    viewer
      ? supabase
          .from('news_likes')
          .select('news_id')
          .eq('news_id', article.id)
          .eq('user_id', viewer.user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('news_comments')
      .select('id, author_id, body, created_at, hidden_at')
      .eq('news_id', article.id)
      .is('hidden_at', null)
      .order('created_at'),
  ]);
  const names = await displayNames(supabase, [
    article.author_id,
    ...(comments ?? []).map((c) => c.author_id),
  ]);
  const cover = publicUrl('content', article.cover_path);
  const anonymous = common('anonymous');

  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-3">
        <Link href="/news" className="text-sm text-muted hover:underline">
          ← {t('title')}
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{article.title}</h1>
        <p className="text-sm text-muted">
          {article.published_at ? formatDate(article.published_at, locale) : null}
          {article.author_id && names.get(article.author_id)
            ? ` · ${common('by', { name: names.get(article.author_id)! })}`
            : null}
          {article.members_only ? ` · ${common('membersOnly')}` : null}
        </p>
        {article.summary ? <p className="text-lg text-muted">{article.summary}</p> : null}
      </header>
      {cover ? (
        <Image
          src={cover}
          alt=""
          width={1200}
          height={630}
          className="w-full rounded-2xl object-cover"
          unoptimized
          priority
        />
      ) : null}
      <Markdown>{article.body_md}</Markdown>
      {article.tags.length ? (
        <ul className="flex flex-wrap gap-2">
          {article.tags.map((tag) => (
            <li key={tag} className="rounded-full border border-border px-3 py-1 text-sm">
              #{tag}
            </li>
          ))}
        </ul>
      ) : null}

      <LikeButton
        newsId={article.id}
        slug={article.slug}
        liked={Boolean(myLike)}
        count={likeCount ?? 0}
        canLike={isActive}
      />

      <section className="space-y-4 border-t border-border pt-6" aria-labelledby="comments">
        <h2 id="comments" className="text-xl font-bold">
          {t('comments')} ({comments?.length ?? 0})
        </h2>
        <ul className="space-y-4">
          {(comments ?? []).map((c) => (
            <li key={c.id} className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-semibold">
                {names.get(c.author_id) ?? anonymous}{' '}
                <span className="font-normal text-muted">
                  · {formatDateTime(c.created_at, locale)}
                </span>
              </p>
              <p className="mt-1 whitespace-pre-line">{c.body}</p>
              <div className="mt-2 flex items-start gap-4">
                {viewer && (viewer.user.id === c.author_id || isModerator) ? (
                  <DeleteCommentButton id={c.id} slug={article.slug} />
                ) : null}
                {viewer && viewer.user.id !== c.author_id ? (
                  <ReportButton targetType="news_comment" targetId={c.id} />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        {!article.comments_enabled ? (
          <Alert>{t('commentsClosed')}</Alert>
        ) : isActive ? (
          <CommentForm newsId={article.id} slug={article.slug} />
        ) : (
          <Link href="/auth/sign-in" className={buttonClass('secondary')}>
            {common('signInToContinue')}
          </Link>
        )}
      </section>
    </article>
  );
}
