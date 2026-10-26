'use client';
import { useActionState } from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { initialState } from '@/lib/action-state';
import { Field, Select, Textarea } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import { deleteAccount, submitDataRequest } from '../actions';

const REQUEST_TYPES = ['objection', 'rectification', 'restriction', 'access', 'other'] as const;

export function DataRequestForm() {
  const t = useTranslations('account.privacy');
  const locale = useLocale();
  const format = useFormatter();
  const [state, action] = useActionState(submitDataRequest, initialState);
  const due = state.values?.due
    ? format.dateTime(new Date(state.values.due), { dateStyle: 'long' })
    : '';
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <Field id="request_type" label={t('requestType')}>
        <Select id="request_type" name="request_type" defaultValue="objection">
          {REQUEST_TYPES.map((r) => (
            <option key={r} value={r}>
              {t(`requestTypes.${r}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="details" label={t('requestDetails')}>
        <Textarea id="details" name="details" maxLength={4000} />
      </Field>
      <FormMessage state={state} success={t('requestSent', { date: due })} />
      <SubmitButton variant="secondary">{t('requestSubmit')}</SubmitButton>
    </form>
  );
}

export function DeleteAccountForm() {
  const t = useTranslations('account.privacy');
  const locale = useLocale();
  const [state, action] = useActionState(deleteAccount, initialState);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <label className="flex items-start gap-3">
        <input type="checkbox" name="confirm" required className="mt-1 size-5" />
        <span>{t('deleteConfirm')}</span>
      </label>
      <FormMessage state={state} />
      <SubmitButton variant="danger">{t('deleteButton')}</SubmitButton>
    </form>
  );
}
