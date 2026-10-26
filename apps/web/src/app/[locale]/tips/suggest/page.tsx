import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requireActiveViewer } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/format';
import { Card, PageTitle } from '@/components/ui';
import { TipForm } from '@/components/tip-form';
import { suggestTip } from '../actions';

export default async function SuggestTipPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await requireActiveViewer(locale);
  const t = await getTranslations('tips');
  const supabase = await createClient();
  const { data: mine } = await supabase
    .from('tips')
    .select('id, slug, title, status, review_note, created_at')
    .eq('author_id', viewer.user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageTitle lead={t('suggestLead')}>{t('suggest')}</PageTitle>
      <Card>
        <TipForm
          action={suggestTip}
          submitLabel={t('suggest')}
          success={t('suggestSent')}
          values={{
            title: '',
            locale,
            summary: '',
            body_md: '',
            category: 'beginner_faq',
            difficulty: 'beginner',
            video_url: '',
          }}
          resetOnSuccess
        />
      </Card>
      {mine?.length ? (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">{t('mySuggestions')}</h2>
          <ul className="space-y-2">
            {mine.map((tip) => (
              <li key={tip.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/tips/${tip.slug}`} className="font-semibold hover:underline">
                    {tip.title}
                  </Link>
                  <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold">
                    {t(`status.${tip.status}`)}
                  </span>
                </div>
                <p className="text-xs text-muted">{formatDate(tip.created_at, locale)}</p>
                {tip.review_note ? <p className="mt-2 text-sm">{tip.review_note}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
