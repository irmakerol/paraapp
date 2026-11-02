'use client';
import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ROLES } from '@paraapp/core';
import { initialState } from '@/lib/action-state';
import { Alert, Card, Field, Input, Select, Textarea } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import { sendClubMessage } from './actions';

export function BroadcastForm({
  locale,
  groups,
}: {
  locale: string;
  groups: { id: string; name: string }[];
}) {
  const t = useTranslations('admin.broadcastAdmin');
  const roles = useTranslations('roles');
  const root = useTranslations();
  const [state, action] = useActionState(sendClubMessage, initialState);
  const [audience, setAudience] = useState<'all' | 'role' | 'group'>('all');
  const err = (name: string) =>
    state.fieldErrors?.[name] ? root('auth.errors.validation') : undefined;

  return (
    <form action={action} className="space-y-5" noValidate key={state.ok ? 'sent' : 'draft'}>
      <input type="hidden" name="locale" value={locale} />
      <Card className="space-y-5">
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">{t('audience')}</legend>
          <div className="flex flex-wrap gap-2">
            {(['all', 'role', 'group'] as const).map((a) => (
              <label
                key={a}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 ${
                  audience === a ? 'border-primary bg-primary/10 font-semibold' : 'border-border'
                }`}
              >
                <input
                  type="radio"
                  name="audience"
                  value={a}
                  checked={audience === a}
                  onChange={() => setAudience(a)}
                  className="size-4"
                />
                {t(`audiences.${a}`)}
              </label>
            ))}
          </div>
        </fieldset>
        {audience === 'role' ? (
          <Field id="role" label={t('role')} error={err('role')}>
            <Select id="role" name="role" required defaultValue="">
              <option value="" disabled>
                {t('choose')}
              </option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {roles(r)}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        {audience === 'group' ? (
          groups.length ? (
            <Field id="group" label={t('group')} error={err('group')}>
              <Select id="group" name="group" required defaultValue="">
                <option value="" disabled>
                  {t('choose')}
                </option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Alert>{t('noGroups')}</Alert>
          )
        ) : null}
        <Field id="title" label={t('title')} error={err('title')}>
          <Input id="title" name="title" required minLength={3} maxLength={120} />
        </Field>
        <Field id="body" label={t('body')} help={t('bodyHelp')} error={err('body')}>
          <Textarea id="body" name="body" required rows={6} maxLength={4000} />
        </Field>
      </Card>
      <FormMessage state={state} success={t('sent', { count: state.values?.count ?? '0' })} />
      <SubmitButton>{t('send')}</SubmitButton>
    </form>
  );
}
