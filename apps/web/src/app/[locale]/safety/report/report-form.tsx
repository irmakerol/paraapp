'use client';
import { useActionState, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { INCIDENT_ANONYMITY, INCIDENT_CATEGORIES, INCIDENT_SEVERITIES } from '@paraapp/core';
import { initialState } from '@/lib/action-state';
import { Alert, Card, Field, Input, Select, Textarea } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import type { SiteOption } from '@/components/flight-fields';
import { submitIncident } from '../actions';

export function IncidentForm({ sites, today }: { sites: SiteOption[]; today: string }) {
  const t = useTranslations('safety.report');
  const s = useTranslations('safety');
  const errorsT = useTranslations('auth.errors');
  const locale = useLocale();
  const [state, action] = useActionState(submitIncident, initialState);
  const [anonymity, setAnonymity] = useState<string>('community_anonymous');
  const [siteId, setSiteId] = useState('');
  const [injured, setInjured] = useState(false);
  const [consent, setConsent] = useState(false);
  const err = (name: string) => (state.fieldErrors?.[name] ? errorsT('validation') : undefined);

  return (
    <form action={action} className="space-y-6" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <Card className="space-y-3">
        <fieldset>
          <legend className="mb-2 text-lg font-bold">{t('who')}</legend>
          <div className="space-y-2">
            {INCIDENT_ANONYMITY.map((a) => (
              <label
                key={a}
                className="flex min-h-11 cursor-pointer gap-3 rounded-xl border border-border p-3 has-[:checked]:border-primary"
              >
                <input
                  type="radio"
                  name="anonymity"
                  value={a}
                  checked={anonymity === a}
                  onChange={() => setAnonymity(a)}
                  className="mt-1 size-5 shrink-0"
                />
                <span>
                  <span className="block font-semibold">{s(`anonymity.${a}`)}</span>
                  <span className="block text-sm text-muted">{t(`anonymityHelp.${a}`)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </Card>

      <Card className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="occurred_on" label={t('date')} error={err('occurred_on')}>
            <Input
              id="occurred_on"
              name="occurred_on"
              type="date"
              required
              max={today}
              defaultValue={today}
            />
          </Field>
          <Field id="site_id" label={t('site')}>
            <Select
              id="site_id"
              name="site_id"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
            >
              <option value="">{t('otherSite')}</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </Select>
          </Field>
          {siteId ? null : (
            <Field id="site_name" label={t('siteName')} error={err('site_name')}>
              <Input id="site_name" name="site_name" maxLength={120} />
            </Field>
          )}
          <Field id="category" label={t('category')}>
            <Select id="category" name="category" defaultValue="other">
              {INCIDENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {s(`categories.${c}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="severity" label={t('severity')}>
            <Select id="severity" name="severity" defaultValue="near_miss">
              {INCIDENT_SEVERITIES.map((v) => (
                <option key={v} value={v}>
                  {s(`severities.${v}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field
          id="description"
          label={t('description')}
          help={t('descriptionHelp')}
          error={err('description')}
        >
          <Textarea
            id="description"
            name="description"
            required
            minLength={20}
            maxLength={8000}
            rows={8}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="conditions"
            label={t('conditions')}
            help={t('conditionsHelp')}
            error={err('conditions')}
          >
            <Textarea id="conditions" name="conditions" maxLength={2000} rows={3} />
          </Field>
          <Field
            id="equipment"
            label={t('equipment')}
            help={t('equipmentHelp')}
            error={err('equipment')}
          >
            <Textarea id="equipment" name="equipment" maxLength={500} rows={3} />
          </Field>
        </div>
        <Field id="lessons" label={t('lessons')} help={t('lessonsHelp')} error={err('lessons')}>
          <Textarea id="lessons" name="lessons" maxLength={4000} rows={4} />
        </Field>
        <p className="text-sm text-muted">{t('noNames')}</p>
      </Card>

      <Card className="space-y-4">
        <label className="flex min-h-11 items-center gap-3 font-semibold">
          <input
            type="checkbox"
            name="injured"
            checked={injured}
            onChange={(e) => setInjured(e.target.checked)}
            className="size-5"
          />
          {t('injured')}
        </label>
        {injured ? (
          <div className="space-y-3 rounded-xl border border-border p-4">
            <p className="text-sm">{t('injuryIntro')}</p>
            <label className="flex gap-3">
              <input
                type="checkbox"
                name="special_category_consent"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 size-5 shrink-0"
              />
              <span className="text-sm">{t('injuryConsent')}</span>
            </label>
            {state.fieldErrors?.special_category_consent ? (
              <Alert tone="error">{t('consentNeeded')}</Alert>
            ) : null}
            {consent ? (
              <Field id="injury_details" label={t('injuryDetails')} help={t('injuryDetailsHelp')}>
                <Textarea id="injury_details" name="injury_details" maxLength={4000} rows={4} />
              </Field>
            ) : null}
          </div>
        ) : null}
        {anonymity !== 'fully_anonymous' ? (
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" name="contact_ok" className="size-5" />
            {t('contactOk')}
          </label>
        ) : null}
      </Card>

      <FormMessage state={state} />
      <SubmitButton>{t('submit')}</SubmitButton>
    </form>
  );
}
