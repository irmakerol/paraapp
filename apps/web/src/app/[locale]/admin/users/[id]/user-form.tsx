'use client';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { PILOT_LEVEL_CHOICES } from '@paraapp/core';
import { initialState } from '@/lib/action-state';
import { Card, Field, Input, Select, Textarea } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import { updateUserProfile } from '../actions';

export interface UserValues {
  display_name: string;
  full_name: string;
  city: string;
  home_site: string;
  pilot_level: string;
  bio: string;
}

export function UserForm({
  id,
  values,
  photoUrl,
}: {
  id: string;
  values: UserValues;
  photoUrl: string | null;
}) {
  const t = useTranslations('admin.usersAdmin');
  const p = useTranslations('account.profile');
  const common = useTranslations('common');
  const root = useTranslations();
  const [state, action] = useActionState(updateUserProfile.bind(null, id), initialState);
  const err = (name: string) =>
    state.fieldErrors?.[name] ? root('auth.errors.validation') : undefined;
  // An older level (student, P1, tandem) stays selectable until changed.
  const levels = [
    ...(values.pilot_level &&
    !(PILOT_LEVEL_CHOICES as readonly string[]).includes(values.pilot_level)
      ? [values.pilot_level]
      : []),
    ...PILOT_LEVEL_CHOICES,
  ];

  return (
    <form action={action} className="space-y-5" noValidate>
      <Card className="space-y-5">
        <div className="flex flex-wrap items-center gap-4">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
            <img
              src={photoUrl}
              alt={t('photo')}
              className="size-24 rounded-full border border-border object-cover"
            />
          ) : (
            <div className="flex size-24 items-center justify-center rounded-full border border-dashed border-border text-center text-xs text-muted">
              {t('noPhoto')}
            </div>
          )}
          {photoUrl ? (
            <label className="flex min-h-11 items-center gap-2">
              <input type="checkbox" name="remove_photo" className="size-5" />
              <span>
                <span className="font-semibold">{t('removePhoto')}</span>
                <span className="block text-sm text-muted">{t('removePhotoHelp')}</span>
              </span>
            </label>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="display_name" label={p('displayName')} error={err('display_name')}>
            <Input
              id="display_name"
              name="display_name"
              required
              minLength={2}
              maxLength={40}
              defaultValue={values.display_name}
            />
          </Field>
          <Field id="full_name" label={p('fullName')} error={err('full_name')}>
            <Input
              id="full_name"
              name="full_name"
              maxLength={100}
              defaultValue={values.full_name}
            />
          </Field>
          <Field id="city" label={p('city')} error={err('city')}>
            <Input id="city" name="city" maxLength={80} defaultValue={values.city} />
          </Field>
          <Field id="home_site" label={p('homeSite')} error={err('home_site')}>
            <Input
              id="home_site"
              name="home_site"
              maxLength={120}
              defaultValue={values.home_site}
            />
          </Field>
          <Field id="pilot_level" label={p('pilotLevel')}>
            <Select id="pilot_level" name="pilot_level" defaultValue={values.pilot_level}>
              <option value="">{p('levelNone')}</option>
              {levels.map((l) => (
                <option key={l} value={l}>
                  {p(`levels.${l}` as 'levels.p2')}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field id="bio" label={p('bio')} error={err('bio')}>
          <Textarea id="bio" name="bio" rows={4} maxLength={500} defaultValue={values.bio} />
        </Field>
        <p className="text-sm text-muted">{t('auditNote')}</p>
      </Card>
      <FormMessage state={state} success={common('saved')} />
      <SubmitButton>{common('save')}</SubmitButton>
    </form>
  );
}
