'use client';
import { useActionState, useRef, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  PILOT_LEVELS,
  VISIBILITIES,
  type FieldPrivacy,
  type PrivacyField,
  type UnitPreferences,
} from '@paraapp/core';
import { initialState } from '@/lib/action-state';
import { createClient } from '@/lib/supabase/client';
import { resizeImage } from '@/lib/image';
import { routing } from '@/i18n/routing';
import { Alert, Button, Card, Field, Input, Select, Textarea } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import { saveProfile, setAvatar } from './actions';

interface ProfileValues {
  display_name: string;
  full_name: string;
  country: string;
  city: string;
  home_site: string;
  pilot_level: string;
  years_flying: string;
  wings: string;
  bio: string;
  locale: string;
}

const localeNames: Record<string, string> = { tr: 'Türkçe', en: 'English' };

export function ProfileForm(props: {
  userId: string;
  profile: ProfileValues;
  privacy: FieldPrivacy;
  units: UnitPreferences;
  licence: string;
  avatarUrl: string | null;
  isMinor: boolean;
  isMember: boolean;
}) {
  const t = useTranslations('account.profile');
  const locale = useLocale();
  const [state, action] = useActionState(saveProfile, initialState);
  const [licenceChanged, setLicenceChanged] = useState(false);
  const { profile, privacy } = props;

  const visibility = (field: PrivacyField) => (
    <Select
      name={`privacy_${field}`}
      defaultValue={privacy[field]}
      aria-label={`${t('visibility')}`}
      className="sm:w-44"
    >
      {VISIBILITIES.map((v) => (
        <option key={v} value={v}>
          {t(`visibilityOptions.${v}`)}
        </option>
      ))}
    </Select>
  );

  const row = (field: PrivacyField, control: React.ReactNode) => (
    <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
      {control}
      {visibility(field)}
    </div>
  );

  return (
    <div className="space-y-6">
      {props.isMinor ? <Alert>{t('minorNote')}</Alert> : null}
      {props.isMember ? (
        <p className="inline-block rounded-full bg-brand-orange/20 px-3 py-1 text-sm font-semibold">
          {t('memberBadge')}
        </p>
      ) : null}

      <Card>{row('photo', <AvatarEditor userId={props.userId} url={props.avatarUrl} />)}</Card>

      <form action={action} className="space-y-6" noValidate>
        <input type="hidden" name="locale" value={locale} />
        <Card className="space-y-5">
          <Field id="display_name" label={t('displayName')}>
            <Input
              id="display_name"
              name="display_name"
              defaultValue={profile.display_name}
              required
              minLength={2}
              maxLength={40}
            />
          </Field>
          {row(
            'full_name',
            <Field id="full_name" label={t('fullName')}>
              <Input
                id="full_name"
                name="full_name"
                defaultValue={profile.full_name}
                maxLength={100}
                autoComplete="name"
              />
            </Field>,
          )}
          {row(
            'location',
            <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
              <Field id="country" label={t('country')} help={t('countryHelp')}>
                <Input
                  id="country"
                  name="country"
                  defaultValue={profile.country}
                  maxLength={2}
                  autoComplete="country"
                />
              </Field>
              <Field id="city" label={t('city')}>
                <Input id="city" name="city" defaultValue={profile.city} maxLength={80} />
              </Field>
            </div>,
          )}
          {row(
            'home_site',
            <Field id="home_site" label={t('homeSite')}>
              <Input
                id="home_site"
                name="home_site"
                defaultValue={profile.home_site}
                maxLength={120}
              />
            </Field>,
          )}
          {row(
            'pilot_level',
            <Field id="pilot_level" label={t('pilotLevel')}>
              <Select id="pilot_level" name="pilot_level" defaultValue={profile.pilot_level}>
                <option value="">{t('levelNone')}</option>
                {PILOT_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {t(`levels.${l}`)}
                  </option>
                ))}
              </Select>
            </Field>,
          )}
          {row(
            'years_flying',
            <Field id="years_flying" label={t('yearsFlying')}>
              <Input
                id="years_flying"
                name="years_flying"
                type="number"
                min={0}
                max={80}
                inputMode="numeric"
                defaultValue={profile.years_flying}
              />
            </Field>,
          )}
          {row(
            'wings',
            <Field id="wings" label={t('wings')}>
              <Input id="wings" name="wings" defaultValue={profile.wings} maxLength={200} />
            </Field>,
          )}
          {row(
            'bio',
            <Field id="bio" label={t('bio')}>
              <Textarea id="bio" name="bio" defaultValue={profile.bio} maxLength={500} />
            </Field>,
          )}
          <Field id="licence" label={t('licence')} help={t('licenceHelp')}>
            <Input
              id="licence"
              name="licence"
              defaultValue={props.licence}
              maxLength={40}
              autoComplete="off"
              onChange={() => setLicenceChanged(true)}
            />
          </Field>
          <input type="hidden" name="licence_changed" value={licenceChanged ? '1' : '0'} />
        </Card>

        <Card className="space-y-5">
          <h2 className="text-lg font-semibold">{t('preferences')}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="pref_locale" label={t('language')}>
              <Select id="pref_locale" name="pref_locale" defaultValue={profile.locale}>
                {routing.locales.map((l) => (
                  <option key={l} value={l}>
                    {localeNames[l]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="units_system" label={t('units')}>
              <Select id="units_system" name="units_system" defaultValue={props.units.system}>
                <option value="metric">{t('unitsMetric')}</option>
                <option value="imperial">{t('unitsImperial')}</option>
              </Select>
            </Field>
            <Field id="units_speed" label={t('speed')}>
              <Select id="units_speed" name="units_speed" defaultValue={props.units.speed}>
                <option value="kmh">km/h</option>
                <option value="ms">m/s</option>
                <option value="mph">mph</option>
                <option value="kt">kt</option>
              </Select>
            </Field>
          </div>
        </Card>

        <FormMessage state={state} success={t('saved')} />
        <SubmitButton>{t('save')}</SubmitButton>
      </form>
    </div>
  );
}

function AvatarEditor({ userId, url }: { userId: string; url: string | null }) {
  const t = useTranslations('account.profile');
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(url);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  async function upload(file: File) {
    setError(false);
    try {
      const blob = await resizeImage(file);
      const path = `${userId}/${Date.now()}.webp`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { contentType: 'image/webp', upsert: false });
      if (uploadError) throw uploadError;
      const result = await setAvatar(path);
      if (result.error) throw new Error(result.error);
      setPreview(URL.createObjectURL(blob));
    } catch {
      setError(true);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">{t('photo')}</p>
      <div className="flex items-center gap-4">
        <div className="size-20 overflow-hidden rounded-full border border-border bg-background">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed/blob URLs, no optimisation needed
            <img src={preview} alt="" className="size-full object-cover" />
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            id="avatar-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) startTransition(() => upload(file));
              e.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
          >
            {t('uploadPhoto')}
          </Button>
          {preview ? (
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await setAvatar(null);
                  if (!result.error) setPreview(null);
                })
              }
            >
              {t('removePhoto')}
            </Button>
          ) : null}
        </div>
      </div>
      <p className="text-sm text-muted">{t('photoHelp')}</p>
      {error ? <Alert tone="error">{t('photoHelp')}</Alert> : null}
    </div>
  );
}
