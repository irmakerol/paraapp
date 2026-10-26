import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requireActiveViewer } from '@/lib/session';
import { getPilotCard } from '@/lib/pilots';
import { pilotStats } from '@/lib/flights';
import { statTiles } from '@/components/stats-grid';
import { PageTitle } from '@/components/ui';

export const metadata: Metadata = { robots: { index: false } };

/** My numbers next to theirs. Theirs only count flights I am allowed to see. */
export default async function ComparePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const viewer = await requireActiveViewer(locale);
  const t = await getTranslations('pilots');
  const lt = await getTranslations('logbook');
  const card = await getPilotCard(id);
  if (!card || id === viewer.user.id) notFound();
  const [mine, theirs] = await Promise.all([pilotStats(viewer.user.id), pilotStats(id)]);
  const rawMine = [
    mine?.flights ?? 0,
    mine?.total_s ?? 0,
    mine?.longest_s ?? 0,
    mine?.max_distance_m ?? 0,
    mine?.max_straight_m ?? 0,
    mine?.max_alt_m ?? 0,
    Number(mine?.max_climb_ms ?? 0),
    mine?.sites ?? 0,
  ];
  const rawTheirs = [
    theirs?.flights ?? 0,
    theirs?.total_s ?? 0,
    theirs?.longest_s ?? 0,
    theirs?.max_distance_m ?? 0,
    theirs?.max_straight_m ?? 0,
    theirs?.max_alt_m ?? 0,
    Number(theirs?.max_climb_ms ?? 0),
    theirs?.sites ?? 0,
  ];
  const a = statTiles(mine, lt, locale);
  const b = statTiles(theirs, lt, locale);
  const name = card.display_name ?? t('pilot');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/pilots/${id}`} className="text-sm text-muted hover:underline">
        ← {name}
      </Link>
      <PageTitle lead={t('compareLead')}>{t('compareTitle', { name })}</PageTitle>
      <table className="w-full border-separate border-spacing-y-1 text-left">
        <caption className="sr-only">{t('compareTitle', { name })}</caption>
        <thead>
          <tr className="text-sm text-muted">
            <th scope="col" className="py-2 font-semibold">
              <span className="sr-only">{t('stat')}</span>
            </th>
            <th scope="col" className="py-2 text-right font-semibold">
              {t('you')}
            </th>
            <th scope="col" className="py-2 text-right font-semibold">
              {name}
            </th>
          </tr>
        </thead>
        <tbody>
          {a.map((tile, i) => {
            const mineWins = rawMine[i]! > rawTheirs[i]!;
            const theirsWin = rawTheirs[i]! > rawMine[i]!;
            return (
              <tr key={tile.key} className="bg-card">
                <th scope="row" className="rounded-l-xl px-4 py-3 font-medium">
                  {tile.label}
                </th>
                <td
                  className={`px-4 py-3 text-right tabular-nums ${mineWins ? 'font-extrabold' : ''}`}
                >
                  {tile.value}
                </td>
                <td
                  className={`rounded-r-xl px-4 py-3 text-right tabular-nums ${theirsWin ? 'font-extrabold' : ''}`}
                >
                  {b[i]!.value}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-muted">{t('statsNote')}</p>
    </div>
  );
}
