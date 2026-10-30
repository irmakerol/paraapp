import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Role } from '@paraapp/core';
import { publicEnv } from '@/lib/env';
import { nextOnboardingStep, type OnboardingStep } from '@/lib/onboarding';
import type { Viewer } from '@/lib/session';
import type { Database } from './database.types';

/**
 * The phone app signs in natively and sends its Supabase access token as
 * "Authorization: Bearer <token>" instead of cookies. The client acts as that user (RLS applies).
 */
export function createBearerClient(token: string) {
  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  );
}

export interface BearerViewer {
  viewer: Viewer;
  supabase: ReturnType<typeof createBearerClient>;
  onboardingStep: OnboardingStep | null;
}

/** The app user behind a request, verified with the auth server, or null. */
export async function bearerViewer(request: Request): Promise<BearerViewer | null> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  const supabase = createBearerClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  const user = data.user;
  const [{ data: profile }, { data: roles }, { data: pending }, { count }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', user.id),
    supabase.rpc('pending_legal_kinds'),
    supabase.from('consents').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
  ]);
  if (!profile) return null;
  const viewer: Viewer = { user, profile, roles: (roles ?? []).map((r) => r.role as Role) };
  const onboardingStep = nextOnboardingStep({
    status: profile.status,
    pendingLegal: pending ?? [],
    hasConsentRecords: (count ?? 0) > 0,
  });
  return { viewer, supabase, onboardingStep };
}
