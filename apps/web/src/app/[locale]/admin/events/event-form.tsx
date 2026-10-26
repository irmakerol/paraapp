'use client';
import { useActionState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { EVENT_KINDS, EVENT_STATUSES } from '@paraapp/core';
import { initialState } from '@/lib/action-state';
import { Card, Field, Input, Select, Textarea } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import { saveEvent } from './actions';

export interface EventValues {
  title: string;
  description_md: string;
  kind: string;
  starts_at: string;
  ends_at: string;
  site_id: string;
  location_text: string;
  members_only: boolean;
  capacity: string;
  rsvp_deadline: string;
  status: string;
}

export function EventForm({
  id,
  values,
  sites,
}: {
  id: string | null;
  values: EventValues;
  sites: { id: string; name: string }[];
}) {
  const t = useTranslations('admin.eventsAdmin');
  const ev = useTranslations('events');
  const common = useTranslations('common');
  const root = useTranslations();
  const locale = useLocale();
  const [state, action] = useActionState(saveEvent.bind(null, id), initialState);
  const err = (name: string) =>
    state.fieldErrors?.[name] ? root('auth.errors.validation') : undefined;

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <Card className="space-y-5">
        <Field id="title" label={t('eventTitle')} error={err('title')}>
          <Input id="title" name="title" required maxLength={160} defaultValue={values.title} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="kind" label={t('kind')}>
            <Select id="kind" name="kind" defaultValue={values.kind}>
              {EVENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {ev(`kinds.${k}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="status" label={t('status')}>
            <Select id="status" name="status" defaultValue={values.status}>
              {EVENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`statuses.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="starts_at" label={t('startsAt')} help={t('timeHelp')} error={err('starts_at')}>
            <Input
              id="starts_at"
              name="starts_at"
              type="datetime-local"
              required
              defaultValue={values.starts_at}
            />
          </Field>
          <Field id="ends_at" label={t('endsAt')} error={err('ends_at')}>
            <Input
              id="ends_at"
              name="ends_at"
              type="datetime-local"
              required
              defaultValue={values.ends_at}
            />
          </Field>
          <Field id="site_id" label={t('site')}>
            <Select id="site_id" name="site_id" defaultValue={values.site_id}>
              <option value="">—</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="location_text" label={t('location')} error={err('location_text')}>
            <Input
              id="location_text"
              name="location_text"
              maxLength={200}
              defaultValue={values.location_text}
            />
          </Field>
          <Field
            id="capacity"
            label={t('capacity')}
            help={t('capacityHelp')}
            error={err('capacity')}
          >
            <Input
              id="capacity"
              name="capacity"
              type="number"
              min={1}
              max={10000}
              defaultValue={values.capacity}
            />
          </Field>
          <Field id="rsvp_deadline" label={t('deadline')} error={err('rsvp_deadline')}>
            <Input
              id="rsvp_deadline"
              name="rsvp_deadline"
              type="datetime-local"
              defaultValue={values.rsvp_deadline}
            />
          </Field>
        </div>
        <Field
          id="description_md"
          label={t('description')}
          help={t('markdownHelp')}
          error={err('description_md')}
        >
          <Textarea
            id="description_md"
            name="description_md"
            rows={8}
            maxLength={10000}
            defaultValue={values.description_md}
          />
        </Field>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            name="members_only"
            defaultChecked={values.members_only}
            className="size-5"
          />
          {t('membersOnly')}
        </label>
      </Card>
      <FormMessage state={state} success={common('saved')} />
      <SubmitButton>{common('save')}</SubmitButton>
    </form>
  );
}
