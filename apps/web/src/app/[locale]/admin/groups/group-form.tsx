'use client';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { initialState } from '@/lib/action-state';
import { Field, Input } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import { saveGroup } from './actions';

export function GroupForm({
  id,
  values,
}: {
  id: string | null;
  values: { name: string; description: string };
}) {
  const t = useTranslations('admin.groupsAdmin');
  const common = useTranslations('common');
  const root = useTranslations();
  const [state, action] = useActionState(saveGroup.bind(null, id), initialState);
  const err = (name: string) => {
    const key = state.fieldErrors?.[name];
    if (!key) return undefined;
    return key.includes('.') ? root(key) : root('auth.errors.validation');
  };
  return (
    <form action={action} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`name-${id ?? 'new'}`} label={t('name')} error={err('name')}>
          <Input
            id={`name-${id ?? 'new'}`}
            name="name"
            required
            minLength={2}
            maxLength={60}
            defaultValue={values.name}
            placeholder={t('namePlaceholder')}
          />
        </Field>
        <Field
          id={`description-${id ?? 'new'}`}
          label={t('description')}
          error={err('description')}
        >
          <Input
            id={`description-${id ?? 'new'}`}
            name="description"
            maxLength={300}
            defaultValue={values.description}
          />
        </Field>
      </div>
      <FormMessage state={state} success={common('saved')} />
      <SubmitButton>{id ? common('save') : t('create')}</SubmitButton>
    </form>
  );
}
