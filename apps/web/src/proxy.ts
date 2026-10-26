import createIntlMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';
import { refreshSession } from '@/lib/supabase/proxy';

const intl = createIntlMiddleware(routing);

export default async function proxy(request: NextRequest) {
  const response = intl(request);
  return refreshSession(request, response);
}

export const config = {
  // Everything except API/auth routes, Next.js internals and files with an extension.
  matcher: ['/((?!api|auth|_next|_vercel|.*\\..*).*)'],
};
