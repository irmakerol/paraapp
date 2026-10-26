import createIntlMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';
import { refreshSession } from '@/lib/supabase/proxy';

const intl = createIntlMiddleware(routing);

export default async function proxy(request: NextRequest) {
  const response = await refreshSession(request, intl(request));
  // Tells the service worker not to keep this page for offline use (it may contain personal data).
  if (
    request.cookies.getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'))
  ) {
    response.headers.set('x-paraapp-session', '1');
  }
  return response;
}

export const config = {
  // Everything except API/auth routes, Next.js internals and files with an extension.
  matcher: ['/((?!api|auth|_next|_vercel|.*\\..*).*)'],
};
