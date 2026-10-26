'use client';
import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import {
  AD_CATEGORIES,
  AD_CONDITIONS,
  CURRENCIES,
  MAX_AD_PHOTOS,
  needsSafetyNotice,
  type AdCategory,
} from '@paraapp/core';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { resizeImage } from '@/lib/image';
import { publicEnv } from '@/lib/env';
import type { ActionState } from '@/lib/action-state';
import { Alert, Button, Field, Input, Select, Textarea } from '@/components/ui';
import { FormMessage } from '@/components/form-message';
import { saveAd } from './actions';

export interface AdFormValues {
  title: string;
  category: string;
  brand: string;
  model: string;
  size: string;
  weight_min: string;
  weight_max: string;
  year: string;
  hours: string;
  flights: string;
  certification: string;
  last_check_date: string;
  reserve_repack_date: string;
  condition: string;
  price: string;
  currency: string;
  city: string;
  location_text: string;
  description: string;
  is_club: boolean;
}

interface Photo {
  key: string;
  /** Existing photo in storage. */
  path?: string;
  /** New photo, already resized in the browser. */
  blob?: Blob;
  preview: string;
}

const photoUrl = (path: string) =>
  `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ad-photos/${path}`;

export function AdForm({
  adId,
  userId,
  values,
  photos: initialPhotos,
  canPostAsClub,
}: {
  adId: string | null;
  userId: string;
  values: AdFormValues;
  photos: { path: string; position: number }[];
  canPostAsClub: boolean;
}) {
  const t = useTranslations('market');
  const common = useTranslations('common');
  const root = useTranslations();
  const router = useRouter();
  const [state, setState] = useState<ActionState>({});
  const [pending, start] = useTransition();
  const [category, setCategory] = useState(values.category as AdCategory);
  const [photos, setPhotos] = useState<Photo[]>(() =>
    [...initialPhotos]
      .sort((a, b) => a.position - b.position)
      .map((p) => ({ key: p.path, path: p.path, preview: photoUrl(p.path) })),
  );
  const [removed, setRemoved] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const room = MAX_AD_PHOTOS - photos.length;
    const picked = Array.from(files).slice(0, room);
    const next: Photo[] = [];
    for (const file of picked) {
      try {
        const blob = await resizeImage(file, 1600, 0.82);
        next.push({ key: crypto.randomUUID(), blob, preview: URL.createObjectURL(blob) });
      } catch {
        // Unsupported image: skip it.
      }
    }
    setPhotos((current) => [...current, ...next].slice(0, MAX_AD_PHOTOS));
    if (fileInput.current) fileInput.current.value = '';
  }

  function removePhoto(photo: Photo) {
    setPhotos((current) => current.filter((p) => p.key !== photo.key));
    if (photo.path) setRemoved((r) => [...r, photo.path!]);
  }

  function move(index: number, delta: number) {
    setPhotos((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  function submit(formData: FormData) {
    start(async () => {
      const result = await saveAd(adId, formData);
      if (!result.ok || !result.values?.id) {
        setState(result);
        return;
      }
      const id = result.values.id;
      const supabase = createClient();
      try {
        // Replace the photo rows wholesale: simplest way to keep positions unique and ordered.
        await supabase.from('ad_photos').delete().eq('ad_id', id);
        if (removed.length) await supabase.storage.from('ad-photos').remove(removed);
        const rows: { ad_id: string; path: string; position: number }[] = [];
        for (const [position, photo] of photos.entries()) {
          let path = photo.path;
          if (!path && photo.blob) {
            path = `${userId}/${id}/${crypto.randomUUID()}.webp`;
            const { error } = await supabase.storage
              .from('ad-photos')
              .upload(path, photo.blob, { contentType: 'image/webp' });
            if (error) throw error;
          }
          if (path) rows.push({ ad_id: id, path, position });
        }
        if (rows.length) {
          const { error } = await supabase.from('ad_photos').insert(rows);
          if (error) throw error;
        }
      } catch {
        setState({ error: 'generic' });
        router.push(`/market/${id}/edit`);
        return;
      }
      router.push(`/market/${id}`);
      router.refresh();
    });
  }

  const err = (name: string) =>
    state.fieldErrors?.[name] ? root(`auth.errors.${state.fieldErrors[name]}`) : undefined;
  const text = (
    name: keyof AdFormValues,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <Field id={name} label={t(`fields.${name}`)} error={err(name)}>
      <Input id={name} name={name} defaultValue={String(values[name] ?? '')} {...props} />
    </Field>
  );

  return (
    <form action={submit} className="space-y-6" noValidate>
      <fieldset className="space-y-4 rounded-2xl border border-border bg-card p-5">
        {text('title', { required: true, minLength: 3, maxLength: 120 })}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="category" label={t('fields.category')}>
            <Select
              id="category"
              name="category"
              defaultValue={values.category}
              onChange={(e) => setCategory(e.target.value as AdCategory)}
            >
              {AD_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`categories.${c}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="condition" label={t('fields.condition')}>
            <Select id="condition" name="condition" defaultValue={values.condition}>
              {AD_CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {t(`conditions.${c}`)}
                </option>
              ))}
            </Select>
          </Field>
          {text('brand', { maxLength: 60 })}
          {text('model', { maxLength: 80 })}
          {text('size', { maxLength: 20, placeholder: 'S, M, 22, …' })}
          {text('certification', { maxLength: 20, placeholder: 'EN-B' })}
          {text('weight_min', { type: 'number', min: 20, max: 300, inputMode: 'numeric' })}
          {text('weight_max', { type: 'number', min: 20, max: 300, inputMode: 'numeric' })}
          {text('year', { type: 'number', min: 1980, max: 2100, inputMode: 'numeric' })}
          {text('hours', { type: 'number', min: 0, step: '0.1', inputMode: 'decimal' })}
          {text('flights', { type: 'number', min: 0, inputMode: 'numeric' })}
          {text('last_check_date', { type: 'date' })}
          {category === 'reserve' || category === 'harness'
            ? text('reserve_repack_date', { type: 'date' })
            : null}
        </div>
        {needsSafetyNotice(category) ? <Alert tone="error">{t('safetyNotice')}</Alert> : null}
      </fieldset>

      <fieldset className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          {text('price', {
            type: 'number',
            min: 0,
            step: '1',
            required: true,
            inputMode: 'decimal',
          })}
          <Field id="currency" label={t('fields.currency')}>
            <Select id="currency" name="currency" defaultValue={values.currency}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          {text('city', { maxLength: 80 })}
        </div>
        {text('location_text', { maxLength: 120 })}
        <Field id="description" label={t('fields.description')} error={err('description')}>
          <Textarea
            id="description"
            name="description"
            maxLength={5000}
            rows={8}
            defaultValue={values.description}
          />
        </Field>
        {canPostAsClub ? (
          <label className="flex items-center gap-2 font-medium">
            <input
              type="checkbox"
              name="is_club"
              defaultChecked={values.is_club}
              className="size-5"
            />
            {t('fields.is_club')}
          </label>
        ) : null}
      </fieldset>

      <fieldset className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <legend className="px-1 font-semibold">{t('fields.photos')}</legend>
        <p className="text-sm text-muted">{t('photosHelp')}</p>
        {photos.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {photos.map((photo, i) => (
              <li key={photo.key} className="space-y-1">
                <Image
                  src={photo.preview}
                  alt=""
                  width={240}
                  height={180}
                  className="aspect-[4/3] w-full rounded-lg object-cover"
                  unoptimized
                />
                <div className="flex justify-between gap-1 text-sm">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    aria-label="←"
                    disabled={i === 0}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    className="text-danger hover:underline"
                    onClick={() => removePhoto(photo)}
                  >
                    {t('removePhoto')}
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    aria-label="→"
                    disabled={i === photos.length - 1}
                  >
                    →
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {photos.length < MAX_AD_PHOTOS ? (
          <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-border px-4 font-semibold hover:bg-background">
            {t('addPhotos')}
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              multiple
              className="sr-only"
              onChange={(e) => void addFiles(e.target.files)}
            />
          </label>
        ) : null}
      </fieldset>

      <Alert>{t('disclaimer')}</Alert>
      <FormMessage state={state} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {common('save')}
        </Button>
      </div>
    </form>
  );
}
