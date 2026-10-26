'use client';
import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useLocale, useTranslations } from 'next-intl';
import { formatDistance, formatDuration } from '@paraapp/core';
import { Link } from '@/i18n/navigation';
import type { FlightListItem } from '@/lib/flights';

const ROW_HEIGHT = 64;

/** Virtualised so a logbook with thousands of flights stays fast. */
export function FlightList({
  flights,
  showVisibility,
}: {
  flights: FlightListItem[];
  showVisibility: boolean;
}) {
  const t = useTranslations('logbook');
  const locale = useLocale();
  const parent = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual is designed this way
  const virtualizer = useVirtualizer({
    count: flights.length,
    getScrollElement: () => parent.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone: 'Europe/Istanbul',
  });

  return (
    <div
      ref={parent}
      className="max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-card"
      role="list"
      aria-label={t('flights')}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((item) => {
          const f = flights[item.index]!;
          return (
            <div
              key={f.id}
              role="listitem"
              className="absolute left-0 right-0 border-b border-border"
              style={{ height: ROW_HEIGHT, transform: `translateY(${item.start}px)` }}
            >
              <Link
                href={`/flights/${f.id}`}
                className="flex h-full items-center gap-3 px-4 hover:bg-background"
              >
                <span className="w-28 shrink-0 text-sm text-muted">
                  {date.format(new Date(f.startedAt))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{f.site ?? t('unknownSite')}</span>
                  <span className="block truncate text-xs text-muted">
                    {f.glider ?? ''}
                    {f.source === 'manual' ? ` · ${t('manual')}` : ''}
                  </span>
                </span>
                <span className="w-14 shrink-0 text-right font-semibold tabular-nums">
                  {formatDuration(f.durationS)}
                </span>
                <span className="hidden w-20 shrink-0 text-right tabular-nums sm:block">
                  {f.distanceM !== null ? formatDistance(f.distanceM, locale) : '–'}
                </span>
                <span className="hidden w-20 shrink-0 text-right tabular-nums md:block">
                  {f.maxAltM !== null ? `${f.maxAltM} m` : '–'}
                </span>
                {showVisibility ? (
                  <span
                    className="w-6 shrink-0 text-center"
                    title={t(`visibility.${f.visibility}`)}
                  >
                    <span aria-hidden>
                      {f.visibility === 'public' ? '🌍' : f.visibility === 'members' ? '👥' : '🔒'}
                    </span>
                    <span className="sr-only">{t(`visibility.${f.visibility}`)}</span>
                  </span>
                ) : null}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
