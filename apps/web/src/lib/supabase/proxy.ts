import { createServerClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';
import { publicEnv } from '@/lib/env';

/** Refreshes the Supabase session cookies on the response the i18n proxy produced. */
export async function refreshSession(request: NextRequest, response: NextResponse) {
  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );
  try {
    await supabase.auth.getClaims();
  } catch {
    // Backend unreachable: render as signed out rather than failing the request.
  }
  return response;
}
