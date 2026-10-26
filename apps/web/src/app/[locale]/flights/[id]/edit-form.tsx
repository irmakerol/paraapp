'use client';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { initialState } from '@/lib/action-state';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import { FlightFields, type SiteOption, type WingOption } from '@/components/flight-fields';
import { updateFlight } from '../../logbook/actions';

export function FlightEditForm(props: {
  id: string;
  sites: SiteOption[];
  wings: WingOption[];
  isMinor: boolean;
  values: Parameters<typeof FlightFields>[0]['values'];
}) {
  const common = useTranslations('common');
  const errorsT = useTranslations('auth.errors');
  const [state, action] = useActionState(updateFlight.bind(null, props.id), initialState);
  const err = (name: string) => (state.fieldErrors?.[name] ? errorsT('validation') : undefined);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FlightFields
        sites={props.sites}
        wings={props.wings}
        isMinor={props.isMinor}
        showLanding
        values={props.values}
        errors={{ site_name: err('site_name'), notes: err('notes') }}
      />
      <FormMessage state={state} success={common('saved')} />
      <SubmitButton>{common('save')}</SubmitButton>
    </form>
  );
}
