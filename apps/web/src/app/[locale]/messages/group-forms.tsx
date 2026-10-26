'use client';
import { useActionState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { initialState } from '@/lib/action-state';
import { Card, Field, Input, Select } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import { addGroupMember, createGroup, renameGroup } from './group-actions';

type Person = { id: string; name: string };

export function NewGroupForm({ people }: { people: Person[] }) {
  const t = useTranslations('groups');
  const root = useTranslations();
  const locale = useLocale();
  const [state, action] = useActionState(createGroup, initialState);
  const membersError = state.fieldErrors?.members;
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <Card className="space-y-4">
        <Field
          id="title"
          label={t('name')}
          error={state.fieldErrors?.title ? root('auth.errors.validation') : undefined}
        >
          <Input id="title" name="title" required maxLength={80} />
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{t('members')}</legend>
          <p className="mb-2 text-sm text-muted">{t('membersHelp')}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {people.map((p) => (
              <label
                key={p.id}
                className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3"
              >
                <input type="checkbox" name="members" value={p.id} className="size-5" />
                {p.name}
              </label>
            ))}
          </div>
          {membersError ? <p className="mt-2 text-sm text-danger">{root(membersError)}</p> : null}
        </fieldset>
      </Card>
      <FormMessage state={state} />
      <SubmitButton>{t('create')}</SubmitButton>
    </form>
  );
}

export function AddMemberForm({ chatId, people }: { chatId: string; people: Person[] }) {
  const t = useTranslations('groups');
  const [state, action] = useActionState(addGroupMember, initialState);
  if (!people.length) return null;
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="chat_id" value={chatId} />
      <Field id="add-member" label={t('add')}>
        <Select id="add-member" name="user_id">
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <SubmitButton variant="secondary">{t('addButton')}</SubmitButton>
      <FormMessage state={state} success={t('added')} />
    </form>
  );
}

export function RenameForm({ chatId, title }: { chatId: string; title: string }) {
  const t = useTranslations('groups');
  const common = useTranslations('common');
  const [state, action] = useActionState(renameGroup, initialState);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="chat_id" value={chatId} />
      <Field id="rename" label={t('name')}>
        <Input id="rename" name="title" required maxLength={80} defaultValue={title} />
      </Field>
      <SubmitButton variant="secondary">{common('save')}</SubmitButton>
      <FormMessage state={state} success={common('saved')} />
    </form>
  );
}
