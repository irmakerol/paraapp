'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  ageGroup,
  isoDateSchema,
  signInSchema,
  signUpSchema,
  todayIso,
  emailSchema,
  passwordSchema,
} from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import { authErrorKey, type ActionState } from '@/lib/action-state';
import { routing } from '@/i18n/routing';
import { preferredLocale } from '@/lib/preferred-locale-server';

function localeFrom(formData: FormData): string {
  const value = String(formData.get('locale') ?? '');
  return (routing.locales as readonly string[]).includes(value) ? value : routing.defaultLocale;
}

const site = () => publicEnv.NEXT_PUBLIC_SITE_URL;

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeFrom(formData);
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: 'invalidCredentials' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorKey(error.code) };
  redirect(`/${await preferredLocale(supabase, data.user.id, locale)}/onboarding`);
}

const signUpForm = signUpSchema.extend({
  display_name: z.string().trim().min(2).max(40),
  birth_date: isoDateSchema,
});

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeFrom(formData);
  const parsed = signUpForm.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    display_name: formData.get('display_name'),
    birth_date: formData.get('birth_date'),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0]);
      fieldErrors[field] =
        field === 'birth_date'
          ? 'invalidDate'
          : field === 'password'
            ? 'weakPassword'
            : 'validation';
    }
    return { error: 'validation', fieldErrors };
  }
  const { email, password, display_name, birth_date } = parsed.data;
  if (ageGroup(birth_date, todayIso()) === 'too_young') {
    return { error: 'tooYoung', fieldErrors: { birth_date: 'tooYoung' } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${site()}/${locale}/onboarding`,
      data: { display_name, birth_date, locale },
    },
  });
  if (error) return { error: authErrorKey(error.code) };
  redirect(`/${locale}/auth/check-email?email=${encodeURIComponent(email)}`);
}

export async function sendMagicLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeFrom(formData);
  const parsed = emailSchema.safeParse(formData.get('email'));
  if (!parsed.success) return { error: 'validation' };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { shouldCreateUser: false, emailRedirectTo: `${site()}/${locale}/onboarding` },
  });
  // Do not reveal whether the address has an account.
  if (error && authErrorKey(error.code) === 'rateLimited') return { error: 'rateLimited' };
  return { ok: true };
}

export async function requestPasswordReset(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = localeFrom(formData);
  const parsed = emailSchema.safeParse(formData.get('email'));
  if (!parsed.success) return { error: 'validation' };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${site()}/${locale}/auth/reset-password`,
  });
  if (error && authErrorKey(error.code) === 'rateLimited') return { error: 'rateLimited' };
  return { ok: true };
}

export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = passwordSchema.safeParse(formData.get('password'));
  if (!parsed.success) return { error: 'weakPassword' };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { error: authErrorKey(error.code) };
  return { ok: true };
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const locale = localeFrom(formData);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${site()}/auth/callback?next=/${locale}/onboarding` },
  });
  if (error || !data.url) redirect(`/${locale}/auth/sign-in?error=generic`);
  redirect(data.url);
}

export async function signOut(formData: FormData): Promise<void> {
  const locale = localeFrom(formData);
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: 'local' });
  redirect(`/${locale}`);
}

export async function signOutEverywhere(formData: FormData): Promise<void> {
  const locale = localeFrom(formData);
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: 'global' });
  redirect(`/${locale}`);
}
