'use client';
import { useActionState, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { DEFAULT_INTERVALS_MONTHS, EQUIPMENT_KINDS, type EquipmentKind } from '@paraapp/core';
import { initialState } from '@/lib/action-state';
import { Card, Field, Input, Select, Textarea } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import { saveEquipment } from './actions';

export interface EquipmentValues {
  kind: EquipmentKind;
  brand: string;
  model: string;
  size: string;
  certification: string;
  purchased_on: string;
  last_check_on: string;
  check_interval_months: string;
  last_repack_on: string;
  repack_interval_months: string;
  notes: string;
}

export function EquipmentForm({
  id,
  values,
  today,
}: {
  id: string | null;
  values: EquipmentValues;
  today: string;
}) {
  const t = useTranslations('equipment');
  const common = useTranslations('common');
  const errorsT = useTranslations('auth.errors');
  const locale = useLocale();
  const [state, action] = useActionState(saveEquipment.bind(null, id), initialState);
  const [kind, setKind] = useState<EquipmentKind>(values.kind);
  const err = (name: string) => (state.fieldErrors?.[name] ? errorsT('validation') : undefined);
  // New items start with the suggested intervals for their kind.
  const defaults = id ? null : DEFAULT_INTERVALS_MONTHS[kind];
  const showRepack = kind === 'reserve' || values.last_repack_on !== '';

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <Card className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="kind" label={t('kind')}>
            <Select
              id="kind"
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as EquipmentKind)}
            >
              {EQUIPMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`kinds.${k}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="brand" label={t('brand')} error={err('brand')}>
            <Input id="brand" name="brand" maxLength={60} defaultValue={values.brand} />
          </Field>
          <Field id="model" label={t('model')} error={err('model')}>
            <Input id="model" name="model" required maxLength={80} defaultValue={values.model} />
          </Field>
          <Field id="size" label={t('size')} error={err('size')}>
            <Input id="size" name="size" maxLength={20} defaultValue={values.size} />
          </Field>
          <Field id="certification" label={t('certification')} help={t('certificationHelp')}>
            <Input
              id="certification"
              name="certification"
              maxLength={20}
              defaultValue={values.certification}
            />
          </Field>
          <Field id="purchased_on" label={t('purchasedOn')} error={err('purchased_on')}>
            <Input
              id="purchased_on"
              name="purchased_on"
              type="date"
              max={today}
              defaultValue={values.purchased_on}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="last_check_on" label={t('lastCheck')} error={err('last_check_on')}>
            <Input
              id="last_check_on"
              name="last_check_on"
              type="date"
              max={today}
              defaultValue={values.last_check_on}
            />
          </Field>
          <Field
            id="check_interval_months"
            label={t('checkInterval')}
            help={t('intervalHelp')}
            error={err('check_interval_months')}
          >
            <Input
              key={`check-${kind}`}
              id="check_interval_months"
              name="check_interval_months"
              type="number"
              min={1}
              max={120}
              inputMode="numeric"
              defaultValue={
                values.check_interval_months || (defaults?.check ? String(defaults.check) : '')
              }
            />
          </Field>
        </div>
        {showRepack ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="last_repack_on" label={t('lastRepack')} error={err('last_repack_on')}>
              <Input
                id="last_repack_on"
                name="last_repack_on"
                type="date"
                max={today}
                defaultValue={values.last_repack_on}
              />
            </Field>
            <Field
              id="repack_interval_months"
              label={t('repackInterval')}
              error={err('repack_interval_months')}
            >
              <Input
                key={`repack-${kind}`}
                id="repack_interval_months"
                name="repack_interval_months"
                type="number"
                min={1}
                max={60}
                inputMode="numeric"
                defaultValue={
                  values.repack_interval_months || (defaults?.repack ? String(defaults.repack) : '')
                }
              />
            </Field>
          </div>
        ) : null}
        <Field id="notes" label={t('notes')} error={err('notes')}>
          <Textarea id="notes" name="notes" rows={3} maxLength={2000} defaultValue={values.notes} />
        </Field>
        <p className="text-sm text-muted">{t('reminderNote')}</p>
      </Card>
      <FormMessage state={state} />
      <SubmitButton>{common('save')}</SubmitButton>
    </form>
  );
}
