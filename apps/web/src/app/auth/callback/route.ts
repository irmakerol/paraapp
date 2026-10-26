import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { routing } from '@/i18n/routing';
import { redirectTarget } from '../redirect-target';

/** OAuth (Google) and PKCE code exchange. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = redirectTarget(searchParams.get('next'), origin);
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(
    new URL(`/${routing.defaultLocale}/auth/sign-in?error=linkInvalid`, origin),
  );
}
