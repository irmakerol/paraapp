import { getTranslations } from 'next-intl/server';
import { compassPoint, dailyConditions, type DayConditions, type HourRating } from '@paraapp/core';
import { formatDateTime } from '@/lib/format';

/** Arrow pointing where the wind blows to (the forecast gives where it comes from). */
function Arrow({ deg, label }: { deg: number; label: string }) {
  return (
    <svg viewBox="0 0 20 20" className="inline size-4 shrink-0" role="img" aria-label={label}>
      <path
        d="M10 2 L15 14 L10 11 L5 14 Z"
        fill="currentColor"
        transform={`rotate(${deg + 180} 10 10)`}
      />
    </svg>
  );
}

/**
 * One day's numbers in a line: wind range and direction, strongest gust, rain. No "flyable"
 * label: pilots judge for themselves (Irmak, 2026-10-30).
 */
export async function Conditions({ day }: { day: DayConditions }) {
  const t = await getTranslations('weather');
  const kmh = t('kmh');
  const wind =
    day.windMinKmh == null || day.windMaxKmh == null
      ? '–'
      : Math.round(day.windMinKmh) === Math.round(day.windMaxKmh)
        ? `${Math.round(day.windMaxKmh)} ${kmh}`
        : `${Math.round(day.windMinKmh)}–${Math.round(day.windMaxKmh)} ${kmh}`;
  const from = day.directionDeg != null ? t(`compass.${compassPoint(day.directionDeg)}`) : null;
  return (
    <dl className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm tabular-nums">
      <div className="flex items-center gap-1">
        <dt className="sr-only">{t('windLabel')}</dt>
        {day.directionDeg != null ? (
          <Arrow deg={day.directionDeg} label={t('from', { dir: from ?? '' })} />
        ) : null}
        <dd>
          {wind}
          {from ? <span className="text-muted"> · {from}</span> : null}
        </dd>
      </div>
      <div className="flex items-center gap-1">
        <dt className="text-muted">{t('gustsShort')}</dt>
        <dd>{day.gustMaxKmh != null ? `${Math.round(day.gustMaxKmh)} ${kmh}` : '–'}</dd>
      </div>
      <div className="flex items-center gap-1">
        <dt className="text-muted">{t('rainShort')}</dt>
        <dd className={day.rainMm > 0 ? 'font-semibold text-brand-red' : undefined}>
          {day.rainMm} mm
        </dd>
      </div>
    </dl>
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
  const days = dailyConditions(forecast.hours);
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
          <li key={d.date} className="space-y-1 rounded-xl border border-border bg-card p-3">
            <p className="text-sm font-semibold">
              {dayName.format(new Date(`${d.date}T12:00:00+03:00`))}
            </p>
            <Conditions day={d} />
          </li>
        ))}
      </ul>
      <details>
        <summary className="cursor-pointer text-sm font-semibold">{t('hourly')}</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[30rem] text-left text-sm">
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
                  {t('direction')}
                </th>
                <th scope="col" className="py-1.5">
                  {t('gusts')}
                </th>
                <th scope="col" className="py-1.5">
                  {t('rain')}
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
                    {h.windKmh != null ? Math.round(h.windKmh) : '–'}
                  </td>
                  <td className="py-1.5 tabular-nums">
                    {h.directionDeg != null ? (
                      <span className="inline-flex items-center gap-1">
                        <Arrow
                          deg={h.directionDeg}
                          label={t('from', { dir: t(`compass.${compassPoint(h.directionDeg)}`) })}
                        />
                        {t(`compass.${compassPoint(h.directionDeg)}`)} {Math.round(h.directionDeg)}°
                      </span>
                    ) : (
                      '–'
                    )}
                  </td>
                  <td className="py-1.5 tabular-nums">
                    {h.gustKmh != null ? Math.round(h.gustKmh) : '–'}
                  </td>
                  <td className="py-1.5 tabular-nums">{h.precipitation ? h.precipitation : '–'}</td>
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
