import { routing } from '@/i18n/routing';
import { safeNextPath } from '@/lib/safe-redirect';

/** Accepts `next` as a relative path or as an absolute URL on our own origin. */
export function redirectTarget(next: string | null, origin: string): string {
  const fallback = `/${routing.defaultLocale}/onboarding`;
  if (!next) return fallback;
  try {
    const url = new URL(next, origin);
    if (url.origin !== origin) return fallback;
    return safeNextPath(url.pathname + url.search, fallback);
  } catch {
    return fallback;
  }
}
