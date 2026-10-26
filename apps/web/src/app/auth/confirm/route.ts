import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { routing } from '@/i18n/routing';
import { redirectTarget } from '../redirect-target';

const OTP_TYPES: EmailOtpType[] = [
  'signup',
  'magiclink',
  'recovery',
  'email_change',
  'email',
  'invite',
];

/** Email links (sign-up confirmation, magic link, password recovery, email change). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = redirectTarget(searchParams.get('next'), origin);

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(
    new URL(`/${routing.defaultLocale}/auth/sign-in?error=linkInvalid`, origin),
  );
}
