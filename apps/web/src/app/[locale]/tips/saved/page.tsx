import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireActiveViewer } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { Card, PageTitle } from '@/components/ui';
import { TipCard } from '@/components/tip-card';

export default async function SavedTipsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await requireActiveViewer(locale);
  const t = await getTranslations('tips');
  const supabase = await createClient();
  const { data } = await supabase
    .from('tip_bookmarks')
    .select('created_at, tips(slug, title, summary, category, difficulty, video_url)')
    .eq('user_id', viewer.user.id)
    .order('created_at', { ascending: false });
  const tips = (data ?? []).flatMap((b) => (b.tips ? [b.tips] : []));

  return (
    <>
      <PageTitle>{t('saved')}</PageTitle>
      {tips.length === 0 ? (
        <Card>
          <p className="text-muted">{t('noTips')}</p>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tips.map((tip) => (
            <li key={tip.slug}>
              <TipCard tip={tip} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
