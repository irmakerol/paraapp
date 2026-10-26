'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { osmLink, toDms } from '@paraapp/core';
import { Alert, Button, Card } from '@/components/ui';

type Position = { lat: number; lng: number; accuracy: number; altitude: number | null };

export function MyPosition() {
  const t = useTranslations('sos');
  const [pos, setPos] = useState<Position | null>(null);
  const [state, setState] = useState<'idle' | 'locating' | 'error' | 'copied'>('idle');

  function locate() {
    if (!('geolocation' in navigator)) return setState('error');
    setState('locating');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: Math.round(p.coords.accuracy),
          altitude: p.coords.altitude != null ? Math.round(p.coords.altitude) : null,
        });
        setState('idle');
      },
      () => setState('error'),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  const decimal = pos ? `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}` : '';
  const message = pos
    ? t('message', { decimal, dms: toDms(pos.lat, pos.lng), link: osmLink(pos.lat, pos.lng) })
    : '';

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setState('copied');
    } catch {
      setState('error');
    }
  }

  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-bold">{t('positionTitle')}</h2>
      {!pos ? (
        <>
          <p className="text-sm text-muted">{t('positionHelp')}</p>
          <Button onClick={locate} disabled={state === 'locating'} className="w-full sm:w-auto">
            📍 {state === 'locating' ? t('locating') : t('locate')}
          </Button>
        </>
      ) : (
        <>
          <dl className="grid gap-2 sm:grid-cols-[auto_1fr] sm:gap-x-4">
            <dt className="text-sm text-muted">{t('decimal')}</dt>
            <dd className="font-mono text-xl font-bold select-all">{decimal}</dd>
            <dt className="text-sm text-muted">{t('dms')}</dt>
            <dd className="font-mono text-lg select-all">{toDms(pos.lat, pos.lng)}</dd>
            <dt className="text-sm text-muted">{t('accuracy')}</dt>
            <dd>
              ± {pos.accuracy} m
              {pos.altitude != null ? ` · ${t('altitude', { m: pos.altitude })}` : ''}
            </dd>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void copy()}>{t('copy')}</Button>
            <a
              href={`sms:?&body=${encodeURIComponent(message)}`}
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 font-semibold"
            >
              {t('sms')}
            </a>
            <a
              href={osmLink(pos.lat, pos.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 font-semibold"
            >
              {t('openMap')}
            </a>
            <Button variant="ghost" onClick={locate}>
              {t('refresh')}
            </Button>
          </div>
        </>
      )}
      {state === 'copied' ? <p role="status">{t('copied')}</p> : null}
      {state === 'error' ? <Alert tone="error">{t('positionError')}</Alert> : null}
    </Card>
  );
}
