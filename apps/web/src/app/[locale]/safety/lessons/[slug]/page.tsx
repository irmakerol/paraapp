import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/format';
import { Markdown } from '@/components/markdown';

const getLesson = cache(async (slug: string) => {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('safety_lessons')
    .select('slug, title, summary, body_md, category, severity, status, published_at, locale')
    .eq('slug', slug)
    .maybeSingle();
  return data;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const lesson = await getLesson((await params).slug);
  if (!lesson) return {};
  return {
    title: lesson.title,
    description: lesson.summary ?? undefined,
    robots: lesson.status === 'published' ? undefined : { index: false },
  };
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('safety');
  const lesson = await getLesson(slug);
  if (!lesson) notFound();
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <Link href="/safety" className="text-sm text-muted hover:underline">
        ← {t('title')}
      </Link>
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase text-muted">
          {t(`categories.${lesson.category}`)} · {t(`severities.${lesson.severity}`)}
          {lesson.published_at ? ` · ${formatDate(lesson.published_at, locale)}` : ''}
        </p>
        <h1 className="text-3xl font-extrabold leading-tight">{lesson.title}</h1>
        {lesson.summary ? <p className="text-lg text-muted">{lesson.summary}</p> : null}
      </header>
      <Markdown>{lesson.body_md}</Markdown>
      <p className="border-t border-border pt-4 text-sm text-muted">{t('lessonNote')}</p>
    </article>
  );
}
