import 'server-only';
import { cookies } from 'next/headers';
import type { createClient } from '@/lib/supabase/server';
import { isLocale, LOCALE_COOKIE } from './preferred-locale';

/**
 * The language saved on the profile and remembers it in the locale cookie, so a sign-in lands on
 * pages in the language the person chose. New accounts (still onboarding) keep the language they
 * signed up in, since their profile only has the default yet.
 */
export async function preferredLocale(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  fallback: string,
): Promise<string> {
  const { data } = await supabase
    .from('profiles')
    .select('locale, status')
    .eq('id', userId)
    .maybeSingle();
  const locale = data?.status !== 'onboarding' && isLocale(data?.locale) ? data.locale : fallback;
  (await cookies()).set(LOCALE_COOKIE.name, locale, LOCALE_COOKIE.options);
  return locale;
}
