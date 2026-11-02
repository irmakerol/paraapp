import { routing } from '@/i18n/routing';

type Locale = (typeof routing.locales)[number];

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (routing.locales as readonly string[]).includes(value);
}

/** Swaps the language prefix of an app path ("/tr/x" → "/en/x"); other paths are left alone. */
export function withLocale(path: string, locale: string): string {
  if (!isLocale(locale)) return path;
  const match = /^\/([a-z]{2})(?=\/|\?|$)/.exec(path);
  if (!match || !isLocale(match[1])) return path;
  return `/${locale}${path.slice(match[0].length)}`;
}

/** The language prefix of an app path, or the default. */
export function localeOf(path: string): string {
  const first = path.split(/[/?]/)[1];
  return isLocale(first) ? first : routing.defaultLocale;
}

/** next-intl's cookie: remembers the language for visits that start without one in the URL. */
export const LOCALE_COOKIE = {
  name: 'NEXT_LOCALE',
  options: { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' as const },
};
