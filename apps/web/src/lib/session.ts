import 'server-only';
import { cache } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Role } from '@paraapp/core';
import { redirect } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Tables } from '@/lib/supabase/database.types';
import { nextOnboardingStep, type OnboardingStep } from '@/lib/onboarding';

export interface Viewer {
  user: User;
  profile: Tables<'profiles'>;
  roles: Role[];
}

/** The signed-in user, verified with the auth server, or null. */
export const getUser = cache(async (): Promise<User | null> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user;
  } catch {
    return null;
  }
});

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', user.id),
  ]);
  if (!profile) return null;
  // "Last seen" for admins: the database writes at most every 5 minutes; skip the call before that.
  const seen = profile.last_seen_at ? new Date(profile.last_seen_at).getTime() : 0;
  if (Date.now() - seen > 5 * 60_000) await supabase.rpc('touch_last_seen');
  return { user, profile, roles: (roles ?? []).map((r) => r.role) };
});

export const getOnboardingStep = cache(async (viewer: Viewer): Promise<OnboardingStep | null> => {
  const supabase = await createClient();
  const [{ data: pending }, { count }] = await Promise.all([
    supabase.rpc('pending_legal_kinds'),
    supabase
      .from('consents')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', viewer.user.id),
  ]);
  return nextOnboardingStep({
    status: viewer.profile.status,
    pendingLegal: pending ?? [],
    hasConsentRecords: (count ?? 0) > 0,
  });
});

/** For pages that need a fully onboarded user. Redirects otherwise. */
export async function requireActiveViewer(locale: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) {
    return redirect({ href: '/auth/sign-in', locale });
  }
  const step = await getOnboardingStep(viewer);
  if (step) {
    return redirect({ href: `/onboarding/${step}`, locale });
  }
  return viewer;
}

/** For onboarding pages: signed in is enough. */
export async function requireViewer(locale: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) {
    return redirect({ href: '/auth/sign-in', locale });
  }
  return viewer;
}
