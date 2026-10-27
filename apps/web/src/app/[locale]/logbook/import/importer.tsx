'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { MAX_TRACK_FILE_BYTES, formatDuration } from '@paraapp/core';
import { Link } from '@/i18n/navigation';
import { Alert, buttonClass } from '@/components/ui';
import type { ImportResult } from '@/lib/flight-import';
import { addFlightsToTotals, importFlight } from '../actions';

interface Row {
  name: string;
  state: 'waiting' | 'working' | 'done' | 'error';
  result?: ImportResult;
}

export function Importer() {
  const t = useTranslations('logbook');
  const locale = useLocale();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [totals, setTotals] = useState<'ask' | 'saving' | 'added' | 'skipped'>('ask');

  async function run(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);
    setRows(list.map((f) => ({ name: f.name, state: 'waiting' })));
    setTotals('ask');
    setBusy(true);
    for (const [i, file] of list.entries()) {
      setRows((r) => r.map((row, j) => (j === i ? { ...row, state: 'working' } : row)));
      let result: ImportResult;
      if (file.size > MAX_TRACK_FILE_BYTES) {
        result = { ok: false, error: 'tooLarge' };
      } else {
        const data = new FormData();
        data.set('file', file);
        try {
          result = await importFlight(data);
        } catch {
          result = { ok: false, error: 'generic' };
        }
      }
      setRows((r) =>
        r.map((row, j) =>
          j === i ? { ...row, state: result.ok ? 'done' : 'error', result } : row,
        ),
      );
    }
    setBusy(false);
  }

  const done = rows.filter((r) => r.state === 'done').length;
  const imported = rows.flatMap((r) => (r.result?.ok ? [r.result] : []));
  const importedSeconds = imported.reduce((s, r) => s + r.durationS, 0);

  async function addToTotals() {
    setTotals('saving');
    const added = await addFlightsToTotals(imported.map((r) => r.id));
    setTotals(added === null ? 'ask' : 'added');
  }
  const dateFormat = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Istanbul',
  });

  return (
    <div className="space-y-4">
      <label
        className={`flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card p-6 text-center ${busy ? 'opacity-60' : 'hover:bg-background'}`}
      >
        <span className="text-lg font-semibold">{t('import.choose')}</span>
        <span className="text-sm text-muted">{t('import.help')}</span>
        <input
          type="file"
          multiple
          accept=".igc,.gpx,application/gpx+xml"
          className="sr-only"
          disabled={busy}
          onChange={(e) => void run(e.target.files)}
        />
      </label>
      {rows.length ? (
        <ul
          className="divide-y divide-border rounded-2xl border border-border bg-card"
          aria-live="polite"
        >
          {rows.map((row, i) => (
            <li key={`${row.name}-${i}`} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1 truncate font-medium">{row.name}</span>
              <span className="text-sm">
                {row.state === 'waiting' ? t('import.waiting') : null}
                {row.state === 'working' ? t('import.working') : null}
                {row.result?.ok ? (
                  <Link href={`/flights/${row.result.id}`} className="text-success underline">
                    ✓ {dateFormat.format(new Date(row.result.startedAt))} ·{' '}
                    {formatDuration(row.result.durationS)}
                    {row.result.siteName ? ` · ${row.result.siteName}` : ''}
                  </Link>
                ) : null}
                {row.result && !row.result.ok ? (
                  <span className="text-danger">
                    {t(`import.errors.${row.result.error}`)}
                    {row.result.error === 'duplicate' && row.result.id ? (
                      <>
                        {' '}
                        <Link href={`/flights/${row.result.id}`} className="underline">
                          {t('import.open')}
                        </Link>
                      </>
                    ) : null}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {!busy && done > 0 ? (
        <Alert tone="success">
          {t('import.summary', { done, total: rows.length })}{' '}
          <Link href="/logbook" className={buttonClass('ghost', 'ml-2 min-h-9')}>
            {t('title')}
          </Link>
        </Alert>
      ) : null}
      {!busy && done > 0 && totals !== 'skipped' ? (
        <div
          className="space-y-3 rounded-2xl border border-border bg-card p-4"
          role="group"
          aria-labelledby="totals-question"
        >
          {totals === 'added' ? (
            <p className="font-semibold">{t('import.totalsAdded', { count: done })}</p>
          ) : (
            <>
              <p id="totals-question" className="font-semibold">
                {t('import.totalsQuestion', {
                  count: done,
                  duration: formatDuration(importedSeconds),
                })}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={buttonClass('primary')}
                  disabled={totals === 'saving'}
                  onClick={() => void addToTotals()}
                >
                  {t('import.totalsYes')}
                </button>
                <button
                  type="button"
                  className={buttonClass('secondary')}
                  onClick={() => setTotals('skipped')}
                >
                  {t('import.totalsNo')}
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
      <p className="text-sm text-muted">{t('import.privacy')}</p>
    </div>
  );
}
