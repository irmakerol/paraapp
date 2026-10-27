'use client';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { initialState } from '@/lib/action-state';
import { Button, Field, Input, Select, Textarea } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import {
  cancelRegistration,
  registerForTrip,
  toggleInterest,
  updateRegistration,
} from '../actions';

export function InterestButton({ tripId, interested }: { tripId: string; interested: boolean }) {
  const t = useTranslations('trips');
  const [state, action] = useActionState(toggleInterest, initialState);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="trip_id" value={tripId} />
      <input type="hidden" name="interested" value={interested ? '1' : '0'} />
      <SubmitButton variant="secondary" className="w-full">
        {interested ? `★ ${t('interested')}` : `☆ ${t('showInterest')}`}
      </SubmitButton>
      <p className="text-xs text-muted">{interested ? t('interestedHelp') : t('interestHelp')}</p>
      <FormMessage state={state} />
    </form>
  );
}

interface Contact {
  note: string;
  phone: string;
  emergency_name: string;
  emergency_phone: string;
}

function ContactFields({
  values,
  err,
}: {
  values: Contact;
  err: (n: string) => string | undefined;
}) {
  const t = useTranslations('trips');
  return (
    <>
      <Field id="phone" label={t('phone')} help={t('phoneHelp')} error={err('phone')}>
        <Input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          maxLength={30}
          defaultValue={values.phone}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="emergency_name" label={t('emergencyName')} error={err('emergency_name')}>
          <Input
            id="emergency_name"
            name="emergency_name"
            maxLength={100}
            defaultValue={values.emergency_name}
          />
        </Field>
        <Field id="emergency_phone" label={t('emergencyPhone')} error={err('emergency_phone')}>
          <Input
            id="emergency_phone"
            name="emergency_phone"
            type="tel"
            maxLength={30}
            defaultValue={values.emergency_phone}
          />
        </Field>
      </div>
      <Field id="note" label={t('noteToOrganisers')} error={err('note')}>
        <Textarea id="note" name="note" rows={3} maxLength={500} defaultValue={values.note} />
      </Field>
    </>
  );
}

function useFieldErrors(fieldErrors: Record<string, string> | undefined) {
  const root = useTranslations();
  return (name: string) => {
    const key = fieldErrors?.[name];
    return key ? (key.includes('.') ? root(key) : root(`auth.errors.${key}`)) : undefined;
  };
}

export function RegisterForm({
  tripId,
  companionsAllowed,
  waitlist,
  defaults,
}: {
  tripId: string;
  companionsAllowed: boolean;
  waitlist: boolean;
  defaults: Contact;
}) {
  const t = useTranslations('trips');
  const [state, action] = useActionState(registerForTrip, initialState);
  const err = useFieldErrors(state.fieldErrors);
  return (
    <form action={action} className="space-y-3" noValidate>
      <input type="hidden" name="trip_id" value={tripId} />
      {waitlist ? <p className="text-sm font-semibold">{t('waitlistNotice')}</p> : null}
      <ContactFields values={defaults} err={err} />
      {companionsAllowed ? (
        <Field id="companions" label={t('companions')} help={t('companionsHelp')}>
          <Select id="companions" name="companions" defaultValue="0">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="confirm" required className="mt-0.5 size-5 shrink-0" />
        <span>{t('confirmRequirements')}</span>
      </label>
      {err('confirm') ? (
        <p className="text-sm font-medium text-danger" role="alert">
          {err('confirm')}
        </p>
      ) : null}
      <FormMessage state={state} />
      <SubmitButton className="w-full">
        {waitlist ? t('joinWaitlist') : t('subscribe')}
      </SubmitButton>
      <p className="text-xs text-muted">{t('subscribeHelp')}</p>
    </form>
  );
}

export function MyRegistration({ tripId, values }: { tripId: string; values: Contact }) {
  const t = useTranslations('trips');
  const common = useTranslations('common');
  const [state, action] = useActionState(updateRegistration, initialState);
  const [cancelState, cancel] = useActionState(cancelRegistration, initialState);
  const err = useFieldErrors(state.fieldErrors);
  return (
    <div className="space-y-3">
      <details>
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">
          {t('editDetails')}
        </summary>
        <form action={action} className="mt-2 space-y-3" noValidate>
          <input type="hidden" name="trip_id" value={tripId} />
          <ContactFields values={values} err={err} />
          <FormMessage state={state} success={common('saved')} />
          <SubmitButton variant="secondary">{common('save')}</SubmitButton>
        </form>
      </details>
      <details>
        <summary className="flex min-h-11 cursor-pointer items-center text-sm text-danger">
          {t('cancelRegistration')}
        </summary>
        <form action={cancel} className="mt-2 space-y-2">
          <input type="hidden" name="trip_id" value={tripId} />
          <p className="text-sm">{t('cancelConfirm')}</p>
          <FormMessage state={cancelState} />
          <Button variant="danger">{t('cancelRegistration')}</Button>
        </form>
      </details>
    </div>
  );
}
