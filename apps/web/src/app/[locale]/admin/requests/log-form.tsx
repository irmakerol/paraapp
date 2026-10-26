'use client';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { initialState } from '@/lib/action-state';
import { Field, Input, Select, Textarea } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import { logRequest } from './actions';

export function LogRequestForm({ types }: { types: { value: string; label: string }[] }) {
  const t = useTranslations('admin.requestsAdmin');
  const common = useTranslations('common');
  const [state, action] = useActionState(logRequest, initialState);
  return (
    <form action={action} className="space-y-3">
      <h2 className="text-lg font-bold">{t('new')}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="email" label={t('email')}>
          <Input id="email" name="email" type="email" required />
        </Field>
        <Field id="request_type" label={t('type')}>
          <Select id="request_type" name="request_type">
            {types.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field id="details" label={t('details')}>
        <Textarea id="details" name="details" rows={3} maxLength={4000} />
      </Field>
      <FormMessage state={state} success={common('saved')} />
      <SubmitButton>{common('save')}</SubmitButton>
    </form>
  );
}
