import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export interface TipSummary {
  slug: string;
  title: string;
  summary: string | null;
  category: string;
  difficulty: string;
  video_url: string | null;
}

export async function TipCard({ tip }: { tip: TipSummary }) {
  const t = await getTranslations('tips');
  return (
    <Link
      href={`/tips/${tip.slug}`}
      className="flex h-full flex-col gap-2 rounded-2xl border border-border bg-card p-5 transition hover:shadow-md"
    >
      <div className="flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-brand-blue/15 px-2 py-0.5">
          {t(`categories.${tip.category}`)}
        </span>
        <span className="rounded-full bg-brand-yellow/30 px-2 py-0.5">
          {t(`difficulty.${tip.difficulty}`)}
        </span>
        {tip.video_url ? <span aria-hidden>▶</span> : null}
      </div>
      <h2 className="text-lg font-bold leading-snug">{tip.title}</h2>
      {tip.summary ? <p className="text-sm text-muted">{tip.summary}</p> : null}
    </Link>
  );
}
