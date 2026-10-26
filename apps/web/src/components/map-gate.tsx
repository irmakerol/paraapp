'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { MAP_CONSENT_KEY } from '@/lib/map';
import { Button } from './ui';

/**
 * Map tiles come from OpenFreeMap, a third party, so like videos the map loads only after
 * the user agrees. "Always load maps" is remembered in this browser only.
 */
export function MapGate({ children, className }: { children: ReactNode; className?: string }) {
  const t = useTranslations('maps');
  const [allowed, setAllowed] = useState(false);
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    try {
      // Reading browser storage has to wait for the client.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(MAP_CONSENT_KEY) === '1') setAllowed(true);
    } catch {
      // Storage blocked: ask every time.
    }
  }, []);

  if (allowed) return <>{children}</>;
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-2xl bg-brand-navy p-6 text-center text-white ${className ?? 'h-72'}`}
    >
      <Button
        variant="secondary"
        onClick={() => {
          if (remember) {
            try {
              localStorage.setItem(MAP_CONSENT_KEY, '1');
            } catch {
              // Ignore.
            }
          }
          setAllowed(true);
        }}
      >
        {t('load')}
      </Button>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-5"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
        />
        {t('remember')}
      </label>
      <p className="max-w-md text-sm opacity-80">{t('notice')}</p>
    </div>
  );
}
