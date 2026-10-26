'use client';
import { useActionState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { initialState } from '@/lib/action-state';
import { Field, Input } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import { acceptLegal, requestGuardianConsent, saveSignupConsents, submitAge } from './actions';
import type { ReactNode } from 'react';

export function AgeForm() {
  const t = useTranslations();
  const locale = useLocale();
  const [state, action] = useActionState(submitAge, initialState);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <FormMessage state={state} />
      <Field id="birth_date" label={t('auth.birthDate')} help={t('auth.birthDateHelp')}>
        <Input
          id="birth_date"
          name="birth_date"
          type="date"
          required
          aria-describedby="birth_date-help"
        />
      </Field>
      <SubmitButton>{t('onboarding.age.submit')}</SubmitButton>
    </form>
  );
}

export function LegalForm({
  documentIds,
  children,
}: {
  documentIds: string[];
  children: ReactNode;
}) {
  const t = useTranslations('onboarding.legal');
  const locale = useLocale();
  const [state, action] = useActionState(acceptLegal, initialState);
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="locale" value={locale} />
      {documentIds.map((id) => (
        <input key={id} type="hidden" name="document_id" value={id} />
      ))}
      {children}
      <FormMessage state={state} />
      <div className="space-y-3">
        <label className="flex items-start gap-3">
          <input type="checkbox" name="privacy_ack" required className="mt-1 size-5" />
          <span>{t('privacyAck')}</span>
        </label>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="terms_accept" required className="mt-1 size-5" />
          <span>{t('termsAccept')}</span>
        </label>
      </div>
      <SubmitButton>{t('submit')}</SubmitButton>
    </form>
  );
}

export function ConsentsForm({
  documentId,
  items,
}: {
  documentId: string | null;
  items: { type: string; title: string; text: string }[];
}) {
  const t = useTranslations('onboarding.consents');
  const locale = useLocale();
  const [state, action] = useActionState(saveSignupConsents, initialState);
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="document_id" value={documentId ?? ''} />
      <FormMessage state={state} />
      <fieldset className="space-y-4">
        <legend className="sr-only">{t('title')}</legend>
        {items.map((item) => (
          <label
            key={item.type}
            className="flex items-start gap-3 rounded-xl border border-border p-4"
          >
            <input type="checkbox" name={item.type} className="mt-1 size-5" />
            <span>
              <span className="block font-semibold">{item.title}</span>
              <span className="block text-sm text-muted">{item.text}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <SubmitButton>{t('submit')}</SubmitButton>
    </form>
  );
}

export function GuardianForm() {
  const t = useTranslations('onboarding.guardian');
  const locale = useLocale();
  const [state, action] = useActionState(requestGuardianConsent, initialState);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <FormMessage state={state} success={t('sent', { email: state.values?.email ?? '' })} />
      <Field id="guardian_name" label={t('name')}>
        <Input id="guardian_name" name="guardian_name" autoComplete="off" required minLength={2} />
      </Field>
      <Field id="guardian_email" label={t('email')}>
        <Input id="guardian_email" name="guardian_email" type="email" autoComplete="off" required />
      </Field>
      <SubmitButton>{t('submit')}</SubmitButton>
    </form>
  );
}
