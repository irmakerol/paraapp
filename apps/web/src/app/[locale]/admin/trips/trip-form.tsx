'use client';
import { useActionState, useState, useTransition } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { PILOT_LEVELS, TRIP_CURRENCIES, TRIP_EQUIPMENT, TRIP_STATUSES } from '@paraapp/core';
import { initialState } from '@/lib/action-state';
import { createClient } from '@/lib/supabase/client';
import { resizeImage } from '@/lib/image';
import { publicEnv } from '@/lib/env';
import { Card, Field, Input, Select, Textarea } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import { saveTrip } from './actions';

export interface TripValues {
  title: string;
  summary: string;
  description_md: string;
  itinerary_md: string;
  cover_path: string;
  destination_country: string;
  destination_region: string;
  starts_on: string;
  ends_on: string;
  meeting_point: string;
  meeting_at: string;
  registration_opens_at: string;
  registration_deadline: string;
  max_pilots: string;
  min_pilots: string;
  companions_allowed: boolean;
  min_pilot_level: string;
  min_years_flying: string;
  min_flights: string;
  required_equipment: string[];
  requirements_md: string;
  price_amount: string;
  price_currency: string;
  deposit_amount: string;
  payment_deadline: string;
  payment_info_md: string;
  price_includes: string;
  price_excludes: string;
  cancellation_policy: string;
  accommodation: string;
  transport: string;
  members_only: boolean;
  allow_minors: boolean;
  auto_accept: boolean;
  status: string;
  site_ids: string[];
  guides: { id: string; role: string }[];
}

export function TripForm({
  id,
  values,
  sites,
  people,
}: {
  id: string | null;
  values: TripValues;
  sites: { id: string; name: string; region: string | null }[];
  people: { id: string; name: string }[];
}) {
  const t = useTranslations('admin.tripsAdmin');
  const tr = useTranslations('trips');
  const levels = useTranslations('account.profile.levels');
  const common = useTranslations('common');
  const root = useTranslations();
  const locale = useLocale();
  const [state, action] = useActionState(saveTrip.bind(null, id), initialState);
  const [cover, setCover] = useState(values.cover_path);
  const [uploading, start] = useTransition();
  const guideRole = new Map(values.guides.map((g) => [g.id, g.role]));
  const err = (name: string) => {
    const key = state.fieldErrors?.[name];
    return key ? (key.includes('.') ? root(key) : root(`auth.errors.${key}`)) : undefined;
  };

  function uploadCover(file: File | undefined) {
    if (!file) return;
    start(async () => {
      const blob = await resizeImage(file, 1920, 0.82);
      const path = `trips/${crypto.randomUUID()}.webp`;
      const { error } = await createClient()
        .storage.from('content')
        .upload(path, blob, { contentType: 'image/webp' });
      if (!error) setCover(path);
    });
  }

  const text = (name: keyof TripValues, label: string, max: number, help?: string) => (
    <Field id={name} label={label} help={help} error={err(name)}>
      <Input id={name} name={name} maxLength={max} defaultValue={values[name] as string} />
    </Field>
  );
  const area = (name: keyof TripValues, label: string, max: number, rows = 4, help?: string) => (
    <Field id={name} label={label} help={help} error={err(name)}>
      <Textarea
        id={name}
        name={name}
        rows={rows}
        maxLength={max}
        defaultValue={values[name] as string}
      />
    </Field>
  );
  const input = (
    name: keyof TripValues,
    label: string,
    type: string,
    extra: Record<string, string | number> = {},
    help?: string,
  ) => (
    <Field id={name} label={label} help={help} error={err(name)}>
      <Input id={name} name={name} type={type} defaultValue={values[name] as string} {...extra} />
    </Field>
  );
  const check = (name: keyof TripValues, label: string, help?: string) => (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={Boolean(values[name])}
        className="mt-0.5 size-5 shrink-0"
      />
      <span>
        {label}
        {help ? <span className="block text-sm text-muted">{help}</span> : null}
      </span>
    </label>
  );

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="cover_path" value={cover} />

      <Card className="space-y-5">
        <h3 className="text-lg font-bold">{t('basics')}</h3>
        <Field id="title" label={t('tripTitle')} error={err('title')}>
          <Input id="title" name="title" required maxLength={160} defaultValue={values.title} />
        </Field>
        {text('summary', t('summary'), 300, t('summaryHelp'))}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="status" label={t('status')}>
            <Select id="status" name="status" defaultValue={values.status}>
              {TRIP_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`statuses.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
          {text('destination_region', t('region'), 120, t('regionHelp'))}
          {text('destination_country', t('country'), 2, t('countryHelp'))}
          {input('starts_on', t('startsOn'), 'date', { required: 'required' })}
          {input('ends_on', t('endsOn'), 'date', { required: 'required' })}
          {text('meeting_point', t('meetingPoint'), 200)}
          {input('meeting_at', t('meetingAt'), 'datetime-local', {}, t('timeHelp'))}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold">{t('cover')}</p>
          {cover ? (
            <Image
              src={`${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/content/${cover}`}
              alt=""
              width={480}
              height={270}
              className="aspect-video w-full max-w-md rounded-lg object-cover"
              unoptimized
            />
          ) : null}
          <label className="block">
            <span className="sr-only">{t('cover')}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => uploadCover(e.target.files?.[0])}
              className="block min-h-11 text-sm"
            />
          </label>
          {uploading ? <p className="text-sm text-muted">{t('uploading')}</p> : null}
          {cover ? (
            <button
              type="button"
              className="min-h-11 text-sm underline"
              onClick={() => setCover('')}
            >
              {t('removeCover')}
            </button>
          ) : null}
        </div>
        {area('description_md', t('description'), 20000, 8, t('markdownHelp'))}
        {area('itinerary_md', t('itinerary'), 20000, 8, t('itineraryHelp'))}
      </Card>

      <Card className="space-y-4">
        <h3 className="text-lg font-bold">{tr('sites')}</h3>
        <p className="text-sm text-muted">{t('sitesHelp')}</p>
        <fieldset>
          <legend className="sr-only">{tr('sites')}</legend>
          <div className="grid max-h-72 gap-1 overflow-y-auto sm:grid-cols-2">
            {sites.map((s) => (
              <label key={s.id} className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  name="site_ids"
                  value={s.id}
                  defaultChecked={values.site_ids.includes(s.id)}
                  className="size-5"
                />
                <span>
                  {s.name}
                  {s.region ? <span className="text-sm text-muted"> · {s.region}</span> : null}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </Card>

      <Card className="space-y-4">
        <h3 className="text-lg font-bold">{t('seatsAndRequirements')}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {input('max_pilots', t('maxPilots'), 'number', {
            min: 1,
            max: 500,
            required: 'required',
          })}
          {input('min_pilots', t('minPilots'), 'number', { min: 1, max: 500 }, t('minPilotsHelp'))}
          {input('registration_opens_at', t('opensAt'), 'datetime-local', {}, t('opensAtHelp'))}
          {input('registration_deadline', t('deadline'), 'datetime-local')}
          <Field id="min_pilot_level" label={t('minLevel')}>
            <Select
              id="min_pilot_level"
              name="min_pilot_level"
              defaultValue={values.min_pilot_level}
            >
              <option value="">{t('anyLevel')}</option>
              {PILOT_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {levels(l)}
                </option>
              ))}
            </Select>
          </Field>
          {input('min_years_flying', t('minYears'), 'number', { min: 0, max: 80 })}
          {input('min_flights', t('minFlights'), 'number', { min: 0 }, t('minFlightsHelp'))}
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">{t('requiredEquipment')}</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {TRIP_EQUIPMENT.map((e) => (
              <label key={e} className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  name="required_equipment"
                  value={e}
                  defaultChecked={values.required_equipment.includes(e)}
                  className="size-5"
                />
                {tr(`equipment.${e}`)}
              </label>
            ))}
          </div>
        </fieldset>
        {area('requirements_md', t('otherRequirements'), 5000, 3)}
        {check('companions_allowed', t('companionsAllowed'), t('companionsAllowedHelp'))}
        {check('allow_minors', t('allowMinors'), t('allowMinorsHelp'))}
        {check('auto_accept', t('autoAccept'), t('autoAcceptHelp'))}
        {check('members_only', t('membersOnly'))}
      </Card>

      <Card className="space-y-4">
        <h3 className="text-lg font-bold">{tr('priceAndPayment')}</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {input('price_amount', t('price'), 'text', { inputMode: 'decimal' }, t('priceHelp'))}
          <Field id="price_currency" label={t('currency')}>
            <Select id="price_currency" name="price_currency" defaultValue={values.price_currency}>
              {TRIP_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          {input('deposit_amount', t('deposit'), 'text', { inputMode: 'decimal' })}
          {input('payment_deadline', t('paymentDeadline'), 'date')}
        </div>
        {area('price_includes', t('includes'), 2000, 3)}
        {area('price_excludes', t('excludes'), 2000, 3)}
        {area('payment_info_md', t('paymentInfo'), 3000, 3, t('paymentInfoHelp'))}
        {area('cancellation_policy', t('cancellationPolicy'), 3000, 3)}
      </Card>

      <Card className="space-y-4">
        <h3 className="text-lg font-bold">{tr('logistics')}</h3>
        {area('accommodation', t('accommodation'), 2000, 3)}
        {area('transport', t('transport'), 2000, 3)}
      </Card>

      <Card className="space-y-4">
        <h3 className="text-lg font-bold">{tr('guides')}</h3>
        <p className="text-sm text-muted">{t('guidesHelp')}</p>
        <fieldset>
          <legend className="sr-only">{tr('guides')}</legend>
          <ul className="max-h-96 space-y-2 overflow-y-auto">
            {people.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3">
                <label className="flex min-h-11 flex-1 items-center gap-3">
                  <input
                    type="checkbox"
                    name="guide_ids"
                    value={p.id}
                    defaultChecked={guideRole.has(p.id)}
                    className="size-5"
                  />
                  {p.name}
                </label>
                <Input
                  name={`guide_role_${p.id}`}
                  aria-label={t('guideRoleFor', { name: p.name })}
                  placeholder={t('guideRolePlaceholder')}
                  maxLength={60}
                  defaultValue={guideRole.get(p.id) ?? ''}
                  className="max-w-56"
                />
              </li>
            ))}
            {!people.length ? <li className="text-sm text-muted">{t('noPeople')}</li> : null}
          </ul>
        </fieldset>
      </Card>

      <FormMessage state={state} success={common('saved')} />
      <SubmitButton disabled={uploading}>{common('save')}</SubmitButton>
    </form>
  );
}
