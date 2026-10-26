'use client';
import { useActionState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { SITE_KINDS, WIND_DIRECTIONS } from '@paraapp/core';
import { initialState } from '@/lib/action-state';
import { Card, Field, Input, Select, Textarea } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import { saveSite } from './actions';

export interface SiteValues {
  name: string;
  slug: string;
  kind: string;
  lat: string;
  lng: string;
  elevation_m: string;
  region: string;
  wind_directions: string[];
  description: string;
  rules: string;
  verified: boolean;
}

export function SiteForm({ id, values }: { id: string | null; values: SiteValues }) {
  const t = useTranslations('admin.sitesAdmin');
  const sites = useTranslations('sites');
  const common = useTranslations('common');
  const root = useTranslations();
  const locale = useLocale();
  const [state, action] = useActionState(saveSite.bind(null, id), initialState);
  const err = (name: string) => {
    const key = state.fieldErrors?.[name];
    if (!key) return undefined;
    return key.includes('.') ? root(key) : root('auth.errors.validation');
  };

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <Card className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="name" label={t('name')} error={err('name')}>
            <Input id="name" name="name" required maxLength={120} defaultValue={values.name} />
          </Field>
          <Field id="slug" label={t('slug')} help={t('slugHelp')} error={err('slug')}>
            <Input
              id="slug"
              name="slug"
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              defaultValue={values.slug}
            />
          </Field>
          <Field id="kind" label={t('kind')}>
            <Select id="kind" name="kind" defaultValue={values.kind}>
              {SITE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {sites(`kinds.${k}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="region" label={t('region')} error={err('region')}>
            <Input id="region" name="region" maxLength={80} defaultValue={values.region} />
          </Field>
          <Field id="lat" label={t('lat')} help={t('coordsHelp')} error={err('lat')}>
            <Input id="lat" name="lat" required inputMode="decimal" defaultValue={values.lat} />
          </Field>
          <Field id="lng" label={t('lng')} error={err('lng')}>
            <Input id="lng" name="lng" required inputMode="decimal" defaultValue={values.lng} />
          </Field>
          <Field id="elevation_m" label={t('elevation')} error={err('elevation_m')}>
            <Input
              id="elevation_m"
              name="elevation_m"
              type="number"
              defaultValue={values.elevation_m}
            />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{sites('windDirections')}</legend>
          <div className="flex flex-wrap gap-2">
            {WIND_DIRECTIONS.map((d) => (
              <label
                key={d}
                className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3"
              >
                <input
                  type="checkbox"
                  name="wind_directions"
                  value={d}
                  defaultChecked={values.wind_directions.includes(d)}
                  className="size-5"
                />
                {sites(`wind.${d}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <Field
          id="description"
          label={t('description')}
          help={t('markdownHelp')}
          error={err('description')}
        >
          <Textarea
            id="description"
            name="description"
            rows={8}
            maxLength={5000}
            defaultValue={values.description}
          />
        </Field>
        <Field id="rules" label={sites('rules')} error={err('rules')}>
          <Textarea id="rules" name="rules" rows={4} maxLength={3000} defaultValue={values.rules} />
        </Field>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            name="verified"
            defaultChecked={values.verified}
            className="size-5"
          />
          {t('verified')}
        </label>
      </Card>
      <FormMessage state={state} success={common('saved')} />
      <SubmitButton>{common('save')}</SubmitButton>
    </form>
  );
}
