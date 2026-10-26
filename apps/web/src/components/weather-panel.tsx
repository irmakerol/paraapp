import { getTranslations } from 'next-intl/server';
import { dailySummary, type Flyability, type HourRating } from '@paraapp/core';
import { formatDateTime } from '@/lib/format';

export const ratingTone: Record<Flyability, string> = {
  good: 'bg-green-700 text-white',
  marginal: 'bg-brand-yellow text-brand-navy',
  no: 'bg-brand-red text-white',
};

/** Arrow pointing where the wind blows to (the forecast gives where it comes from). */
function Arrow({ deg, label }: { deg: number; label: string }) {
  return (
    <svg viewBox="0 0 20 20" className="inline size-4" role="img" aria-label={label}>
      <path
        d="M10 2 L15 14 L10 11 L5 14 Z"
        fill="currentColor"
        transform={`rotate(${deg + 180} 10 10)`}
      />
    </svg>
  );
}

export async function WeatherPanel({
  forecast,
  locale,
}: {
  forecast: { hours: HourRating[]; fetchedAt: string } | null;
  locale: string;
}) {
  const t = await getTranslations('weather');
  if (!forecast) {
    return <p className="text-sm text-muted">{t('unavailable')}</p>;
  }
  const days = dailySummary(forecast.hours);
  const dayName = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
  const flying = forecast.hours.filter((h) => {
    const hour = Number(h.time.slice(11, 13));
    return hour >= 9 && hour <= 18;
  });

  return (
    <div className="space-y-4">
      <ul className="grid gap-2 sm:grid-cols-3">
        {days.map((d) => (
          <li key={d.date} className="rounded-xl border border-border bg-card p-3">
            <p className="text-sm font-semibold">
              {dayName.format(new Date(`${d.date}T12:00:00+03:00`))}
            </p>
            <p className="mt-1 flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${ratingTone[d.rating]}`}
              >
                {t(`ratings.${d.rating}`)}
              </span>
              <span className="text-xs text-muted">{t('goodHours', { hours: d.goodHours })}</span>
            </p>
          </li>
        ))}
      </ul>
      <details>
        <summary className="cursor-pointer text-sm font-semibold">{t('hourly')}</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <caption className="sr-only">{t('hourly')}</caption>
            <thead>
              <tr className="text-muted">
                <th scope="col" className="py-1.5">
                  {t('time')}
                </th>
                <th scope="col" className="py-1.5">
                  {t('wind')}
                </th>
                <th scope="col" className="py-1.5">
                  {t('gusts')}
                </th>
                <th scope="col" className="py-1.5">
                  {t('rain')}
                </th>
                <th scope="col" className="py-1.5">
                  {t('rating')}
                </th>
              </tr>
            </thead>
            <tbody>
              {flying.map((h) => (
                <tr key={h.time} className="border-t border-border">
                  <th scope="row" className="py-1.5 font-medium tabular-nums">
                    {dayName.format(new Date(`${h.time}:00+03:00`)).split(' ')[0]}{' '}
                    {h.time.slice(11, 16)}
                  </th>
                  <td className="py-1.5 tabular-nums">
                    {h.directionDeg != null ? (
                      <Arrow deg={h.directionDeg} label={`${Math.round(h.directionDeg)}°`} />
                    ) : null}{' '}
                    {h.windKmh != null ? `${Math.round(h.windKmh)} km/h` : '–'}
                  </td>
                  <td className="py-1.5 tabular-nums">
                    {h.gustKmh != null ? `${Math.round(h.gustKmh)} km/h` : '–'}
                  </td>
                  <td className="py-1.5 tabular-nums">
                    {h.precipitation ? `${h.precipitation} mm` : '–'}
                  </td>
                  <td className="py-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${ratingTone[h.rating]}`}
                    >
                      {t(`ratings.${h.rating}`)}
                    </span>{' '}
                    <span className="text-xs text-muted">
                      {h.reasons.map((r) => t(`reasons.${r}`)).join(', ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="text-xs text-muted">
        {t('disclaimer')} {t('updated', { time: formatDateTime(forecast.fetchedAt, locale) })}{' '}
        <a
          href="https://open-meteo.com/"
          className="underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('credit')}
        </a>
      </p>
    </div>
  );
}
