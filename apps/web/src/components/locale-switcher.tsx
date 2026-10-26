'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

const names: Record<string, string> = { tr: 'Türkçe', en: 'English' };

export function LocaleSwitcher() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  return (
    <select
      className="min-h-11 rounded-lg border border-border bg-card px-2 text-sm"
      aria-label={t('language')}
      value={locale}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        startTransition(() => router.replace(pathname, { locale: next }));
      }}
    >
      {routing.locales.map((l) => (
        <option key={l} value={l} lang={l}>
          {names[l]}
        </option>
      ))}
    </select>
  );
}
