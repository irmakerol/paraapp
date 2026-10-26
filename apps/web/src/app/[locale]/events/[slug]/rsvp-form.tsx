'use client';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { RSVP_STATUSES } from '@paraapp/core';
import { initialState } from '@/lib/action-state';
import { Field, Input } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import { rsvp } from '../actions';

export function RsvpForm({
  eventId,
  current,
  note,
}: {
  eventId: string;
  current: string | null;
  note: string;
}) {
  const t = useTranslations('events');
  const [state, action] = useActionState(rsvp, initialState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="event_id" value={eventId} />
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">{t('yourAnswer')}</legend>
        <div className="flex flex-wrap gap-2">
          {RSVP_STATUSES.map((s) => (
            <label
              key={s}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 has-[:checked]:border-primary has-[:checked]:font-semibold"
            >
              <input
                type="radio"
                name="status"
                value={s}
                defaultChecked={current === s}
                required
                className="size-4"
              />
              {t(`rsvp.${s}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <Field id="rsvp-note" label={t('note')} help={t('noteHelp')}>
        <Input id="rsvp-note" name="note" maxLength={300} defaultValue={note} />
      </Field>
      <FormMessage state={state} success={t('saved')} />
      <SubmitButton>{t('send')}</SubmitButton>
    </form>
  );
}
