'use client';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

export function ThemeToggle() {
  const t = useTranslations('nav');
  const { theme, setTheme } = useTheme();
  // Theme is only known on the client; render a stable placeholder on the server.
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">{t('theme')}</span>
      <select
        className="min-h-11 rounded-lg border border-border bg-card px-2"
        value={mounted ? theme : 'light'}
        onChange={(e) => setTheme(e.target.value)}
        aria-label={t('theme')}
      >
        <option value="system">{t('themeSystem')}</option>
        <option value="light">{t('themeLight')}</option>
        <option value="dark">{t('themeDark')}</option>
      </select>
    </label>
  );
}
