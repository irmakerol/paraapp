'use client';
import { useActionState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { initialState } from '@/lib/action-state';
import { Field, Textarea } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import { adminDeleteAccount } from '../actions';

export function DeleteAccountForm({ userId, days }: { userId: string; days: number }) {
  const t = useTranslations('admin.usersAdmin');
  const root = useTranslations();
  const locale = useLocale();
  const [state, action] = useActionState(adminDeleteAccount.bind(null, userId), initialState);
  return (
    <form action={action} className="space-y-3" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <h4 className="font-semibold text-danger">{t('deleteTitle')}</h4>
      <p className="text-sm">{t('deleteLead', { days })}</p>
      <Field id="delete-reason" label={t('deleteReason')}>
        <Textarea id="delete-reason" name="reason" rows={2} maxLength={500} />
      </Field>
      <label className="flex min-h-11 items-center gap-2">
        <input type="checkbox" name="confirm" className="size-5" />
        <span>{t('deleteConfirm')}</span>
      </label>
      {state.fieldErrors?.confirm ? (
        <p className="text-sm font-medium text-danger" role="alert">
          {root('auth.errors.validation')}
        </p>
      ) : null}
      <FormMessage state={state} />
      <SubmitButton variant="danger">{t('deleteButton')}</SubmitButton>
    </form>
  );
}
