'use client';
import { useActionState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { APP_CONFIG } from '@paraapp/core';
import { initialState } from '@/lib/action-state';
import { Field, Input } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import { requestPasswordReset, sendMagicLink, signIn, signUp, updatePassword } from './actions';

export function SignInForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const [state, action] = useActionState(signIn, initialState);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <FormMessage state={state} />
      <Field id="email" label={t('email')}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field id="password" label={t('password')}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>
      <SubmitButton className="w-full">{t('signInSubmit')}</SubmitButton>
    </form>
  );
}

export function MagicLinkForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const [state, action] = useActionState(sendMagicLink, initialState);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <FormMessage state={state} success={t('magicSent')} />
      <Field id="magic-email" label={t('email')}>
        <Input id="magic-email" name="email" type="email" autoComplete="email" required />
      </Field>
      <SubmitButton variant="secondary" className="w-full">
        {t('magicSubmit')}
      </SubmitButton>
    </form>
  );
}

export function SignUpForm() {
  const t = useTranslations('auth');
  const errors = useTranslations('auth.errors');
  const locale = useLocale();
  const [state, action] = useActionState(signUp, initialState);
  const fe = state.fieldErrors ?? {};
  const err = (f: string) => (fe[f] ? errors(fe[f], { app: APP_CONFIG.name }) : undefined);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <FormMessage state={state} />
      <Field
        id="display_name"
        label={t('displayName')}
        help={t('displayNameHelp')}
        error={err('display_name')}
      >
        <Input
          id="display_name"
          name="display_name"
          autoComplete="nickname"
          minLength={2}
          maxLength={40}
          required
          aria-invalid={!!fe.display_name}
          aria-describedby="display_name-help"
        />
      </Field>
      <Field id="email" label={t('email')} error={err('email')}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={!!fe.email}
        />
      </Field>
      <Field id="password" label={t('password')} help={t('passwordHelp')} error={err('password')}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
          aria-invalid={!!fe.password}
          aria-describedby="password-help"
        />
      </Field>
      <Field
        id="birth_date"
        label={t('birthDate')}
        help={t('birthDateHelp')}
        error={err('birth_date')}
      >
        <Input
          id="birth_date"
          name="birth_date"
          type="date"
          required
          aria-invalid={!!fe.birth_date}
          aria-describedby="birth_date-help"
        />
      </Field>
      <p className="text-sm text-muted">{t('signUpLegal')}</p>
      <SubmitButton className="w-full">{t('signUpSubmit')}</SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const [state, action] = useActionState(requestPasswordReset, initialState);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <FormMessage state={state} success={t('forgotSent')} />
      <Field id="email" label={t('email')}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <SubmitButton className="w-full">{t('forgotSubmit')}</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const t = useTranslations('auth');
  const [state, action] = useActionState(updatePassword, initialState);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} success={t('resetDone')} />
      <Field id="password" label={t('password')} help={t('passwordHelp')}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </Field>
      <SubmitButton className="w-full">{t('resetSubmit')}</SubmitButton>
    </form>
  );
}
