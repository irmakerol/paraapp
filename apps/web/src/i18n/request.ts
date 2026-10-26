import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const messages = (await import(`../messages/${locale}.json`)).default;
  const fallback = locale === 'en' ? messages : (await import('../messages/en.json')).default;
  return {
    locale,
    messages: deepMerge(fallback, messages),
  };
});

type Messages = { [key: string]: string | Messages };

/** English is the fallback: any key missing in Turkish shows in English instead of breaking. */
function deepMerge(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = out[key];
    out[key] =
      typeof value === 'object' && typeof current === 'object' ? deepMerge(current, value) : value;
  }
  return out;
}
