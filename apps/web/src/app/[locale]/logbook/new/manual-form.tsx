'use client';
import { useActionState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { initialState } from '@/lib/action-state';
import { Card, Field, Input } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import { FlightFields, type SiteOption, type WingOption } from '@/components/flight-fields';
import { addManualFlight } from '../actions';

export function ManualFlightForm(props: {
  sites: SiteOption[];
  wings: WingOption[];
  isMinor: boolean;
  today: string;
}) {
  const t = useTranslations('logbook');
  const common = useTranslations('common');
  const errorsT = useTranslations('auth.errors');
  const locale = useLocale();
  const [state, action] = useActionState(addManualFlight, initialState);
  const err = (name: string) => (state.fieldErrors?.[name] ? errorsT('validation') : undefined);

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <Card className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-4">
          <Field id="date" label={t('fields.date')} error={err('date')}>
            <Input
              id="date"
              name="date"
              type="date"
              required
              max={props.today}
              defaultValue={props.today}
            />
          </Field>
          <Field id="time" label={t('fields.time')} help={t('fields.timeHelp')}>
            <Input id="time" name="time" type="time" required defaultValue="12:00" />
          </Field>
          <Field id="hours" label={t('fields.hours')}>
            <Input
              id="hours"
              name="hours"
              type="number"
              min={0}
              max={23}
              inputMode="numeric"
              defaultValue={0}
            />
          </Field>
          <Field id="minutes" label={t('fields.minutes')} error={err('minutes')}>
            <Input
              id="minutes"
              name="minutes"
              type="number"
              min={0}
              max={59}
              inputMode="numeric"
              defaultValue={30}
            />
          </Field>
        </div>
        <FlightFields
          sites={props.sites}
          wings={props.wings}
          isMinor={props.isMinor}
          errors={{ site_name: err('site_name'), notes: err('notes') }}
          values={{
            takeoff_site_id: '',
            site_name: '',
            glider: '',
            wing_id: props.wings[0]?.id ?? '',
            visibility: props.isMinor ? 'private' : 'public',
            notes: '',
          }}
        />
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" name="add_to_totals" defaultChecked className="size-5" />
          {t('addToTotals')}
        </label>
      </Card>
      <FormMessage state={state} />
      <SubmitButton>{common('save')}</SubmitButton>
    </form>
  );
}
