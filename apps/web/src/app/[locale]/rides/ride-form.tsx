'use client';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { RIDE_KINDS, RIDE_PURPOSES } from '@paraapp/core';
import { initialState } from '@/lib/action-state';
import { Card, Field, Input, Select, Textarea } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import { postRide } from './actions';

export function RideForm({
  sites,
  today,
}: {
  sites: { id: string; name: string }[];
  today: string;
}) {
  const t = useTranslations('rides');
  const root = useTranslations();
  const [state, action] = useActionState(postRide, initialState);
  const err = (name: string) =>
    state.fieldErrors?.[name] ? root('auth.errors.validation') : undefined;
  return (
    <form action={action} className="space-y-4" noValidate>
      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="kind" label={t('kindLabel')}>
            <Select id="kind" name="kind" defaultValue="offer">
              {RIDE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`kinds.${k}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="purpose" label={t('purposeLabel')}>
            <Select id="purpose" name="purpose" defaultValue="carpool">
              {RIDE_PURPOSES.map((p) => (
                <option key={p} value={p}>
                  {t(`purposes.${p}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="ride_date" label={t('date')} error={err('ride_date')}>
            <Input
              id="ride_date"
              name="ride_date"
              type="date"
              required
              min={today}
              defaultValue={today}
            />
          </Field>
          <Field id="depart_time" label={t('time')} error={err('depart_time')}>
            <Input id="depart_time" name="depart_time" type="time" />
          </Field>
          <Field id="from_text" label={t('from')} help={t('fromHelp')} error={err('from_text')}>
            <Input id="from_text" name="from_text" required maxLength={120} />
          </Field>
          <Field id="site_id" label={t('site')}>
            <Select id="site_id" name="site_id" defaultValue="">
              <option value="">—</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="to_text" label={t('to')} error={err('to_text')}>
            <Input id="to_text" name="to_text" maxLength={120} />
          </Field>
          <Field id="seats" label={t('seats')} error={err('seats')}>
            <Input id="seats" name="seats" type="number" min={1} max={8} />
          </Field>
        </div>
        <Field id="note" label={t('note')} error={err('note')}>
          <Textarea id="note" name="note" rows={3} maxLength={1000} />
        </Field>
        <p className="text-sm text-muted">{t('privacyNote')}</p>
      </Card>
      <FormMessage state={state} success={t('posted')} />
      <SubmitButton>{t('post')}</SubmitButton>
    </form>
  );
}
