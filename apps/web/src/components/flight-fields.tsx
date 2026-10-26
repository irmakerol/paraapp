'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { FLIGHT_VISIBILITIES } from '@paraapp/core';
import { Field, Input, Select, Textarea } from './ui';

export interface SiteOption {
  id: string;
  name: string;
}
export interface WingOption {
  id: string;
  label: string;
}

/** Site, glider, visibility and notes: shared by manual entry and the flight editor. */
export function FlightFields(props: {
  sites: SiteOption[];
  wings: WingOption[];
  isMinor: boolean;
  values: {
    takeoff_site_id: string;
    landing_site_id?: string;
    site_name: string;
    glider: string;
    wing_id: string;
    visibility: string;
    notes: string;
  };
  showLanding?: boolean;
  errors?: Record<string, string | undefined>;
}) {
  const t = useTranslations('logbook');
  const { values, errors = {} } = props;
  const [siteId, setSiteId] = useState(values.takeoff_site_id);
  const visibilities = FLIGHT_VISIBILITIES.filter((v) => !(props.isMinor && v === 'public'));

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="takeoff_site_id" label={t('fields.site')}>
          <Select
            id="takeoff_site_id"
            name="takeoff_site_id"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
          >
            <option value="">{t('fields.otherSite')}</option>
            {props.sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        {siteId ? null : (
          <Field id="site_name" label={t('fields.siteName')} error={errors.site_name}>
            <Input
              id="site_name"
              name="site_name"
              maxLength={120}
              defaultValue={values.site_name}
            />
          </Field>
        )}
        {props.showLanding ? (
          <Field id="landing_site_id" label={t('fields.landingSite')}>
            <Select
              id="landing_site_id"
              name="landing_site_id"
              defaultValue={values.landing_site_id ?? ''}
            >
              <option value="">–</option>
              {props.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="wing_id" label={t('fields.wing')}>
          <Select id="wing_id" name="wing_id" defaultValue={values.wing_id}>
            <option value="">–</option>
            {props.wings.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="glider" label={t('fields.glider')} help={t('fields.gliderHelp')}>
          <Input id="glider" name="glider" maxLength={120} defaultValue={values.glider} />
        </Field>
      </div>
      <Field
        id="visibility"
        label={t('fields.visibility')}
        help={props.isMinor ? t('minorPrivate') : t('trimNote')}
      >
        <Select id="visibility" name="visibility" defaultValue={values.visibility}>
          {visibilities.map((v) => (
            <option key={v} value={v}>
              {t(`visibility.${v}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="notes" label={t('fields.notes')} error={errors.notes}>
        <Textarea id="notes" name="notes" maxLength={2000} rows={4} defaultValue={values.notes} />
      </Field>
    </>
  );
}
