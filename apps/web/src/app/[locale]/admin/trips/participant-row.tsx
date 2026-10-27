'use client';
import { useActionState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { TRIP_PAYMENT_STATUSES, TRIP_REGISTRATION_STATUSES } from '@paraapp/core';
import { initialState } from '@/lib/action-state';
import { Input, Select } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import { messageParticipants, notifyFollowers, updateParticipant } from './actions';

export function ParticipantForm({
  id,
  status,
  payment,
  staffNote,
  name,
}: {
  id: string;
  status: string;
  payment: string;
  staffNote: string;
  name: string;
}) {
  const t = useTranslations('admin.tripsAdmin');
  const tr = useTranslations('trips');
  const common = useTranslations('common');
  const [state, action] = useActionState(updateParticipant, initialState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="registration_id" value={id} />
      <label className="space-y-1 text-xs">
        <span className="block font-semibold">{t('registrationStatus')}</span>
        <Select name="status" defaultValue={status} aria-label={t('statusFor', { name })}>
          {TRIP_REGISTRATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {tr(`status.${s}`)}
            </option>
          ))}
        </Select>
      </label>
      <label className="space-y-1 text-xs">
        <span className="block font-semibold">{t('paymentStatus')}</span>
        <Select name="payment_status" defaultValue={payment} aria-label={t('paymentFor', { name })}>
          {TRIP_PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {tr(`paymentShort.${s}`)}
            </option>
          ))}
        </Select>
      </label>
      <label className="min-w-40 flex-1 space-y-1 text-xs">
        <span className="block font-semibold">{t('staffNote')}</span>
        <Input name="staff_note" maxLength={500} defaultValue={staffNote} />
      </label>
      <SubmitButton variant="secondary">{common('save')}</SubmitButton>
      <div className="w-full">
        <FormMessage state={state} success={common('saved')} />
      </div>
    </form>
  );
}

export function NotifyForm({ tripId }: { tripId: string }) {
  const t = useTranslations('admin.tripsAdmin');
  const [state, action] = useActionState(notifyFollowers, initialState);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="trip_id" value={tripId} />
      <p className="text-sm text-muted">{t('notifyHelp')}</p>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="include_registered" className="size-5" />
        {t('notifyIncludeRegistered')}
      </label>
      <FormMessage
        state={state}
        success={t('notified', { count: Number(state.values?.count ?? 0) })}
      />
      <SubmitButton variant="secondary">{t('notify')}</SubmitButton>
    </form>
  );
}

export function GroupChatForm({ tripId }: { tripId: string }) {
  const t = useTranslations('admin.tripsAdmin');
  const locale = useLocale();
  const [state, action] = useActionState(messageParticipants, initialState);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="trip_id" value={tripId} />
      <input type="hidden" name="locale" value={locale} />
      <p className="text-sm text-muted">{t('groupChatHelp')}</p>
      <FormMessage state={state} />
      <SubmitButton variant="secondary">{t('groupChat')}</SubmitButton>
    </form>
  );
}
