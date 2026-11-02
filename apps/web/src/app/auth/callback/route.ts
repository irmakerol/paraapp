import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { routing } from '@/i18n/routing';
import { redirectTarget } from '../redirect-target';
import { localeOf, withLocale } from '@/lib/preferred-locale';
import { preferredLocale } from '@/lib/preferred-locale-server';

/** OAuth (Google) and PKCE code exchange. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = redirectTarget(searchParams.get('next'), origin);
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const user = data.user;
      const path = user
        ? withLocale(next, await preferredLocale(supabase, user.id, localeOf(next)))
        : next;
      return NextResponse.redirect(new URL(path, origin));
    }
  }
  return NextResponse.redirect(
    new URL(`/${routing.defaultLocale}/auth/sign-in?error=linkInvalid`, origin),
  );
}
