'use client';
import { useActionState, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CURRENCIES, NOTICE_CATEGORIES, NOTICE_KINDS, type NoticeCategory } from '@paraapp/core';
import { Link } from '@/i18n/navigation';
import { initialState, type ActionState } from '@/lib/action-state';
import { resizeImage } from '@/lib/image';
import { Button, Card, Field, Input, Select, Textarea } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import { postNotice } from './actions';

export function NoticeForm({ sites }: { sites: { id: string; name: string }[] }) {
  const t = useTranslations('notices');
  const root = useTranslations();
  const form = useRef<HTMLFormElement>(null);
  const [category, setCategory] = useState<NoticeCategory>('transport');
  const [kind, setKind] = useState<string>('offer');
  const [photo, setPhoto] = useState<{ blob: Blob; preview: string } | null>(null);

  const [state, action] = useActionState(async (prev: ActionState, formData: FormData) => {
    if (photo) formData.set('photo', new File([photo.blob], 'photo.webp', { type: 'image/webp' }));
    const result = await postNotice(prev, formData);
    if (result.ok) {
      form.current?.reset();
      setCategory('transport');
      setKind('offer');
      setPhoto(null);
    }
    return result;
  }, initialState);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const blob = await resizeImage(file, 1280, 0.82);
      setPhoto({ blob, preview: URL.createObjectURL(blob) });
    } catch {
      setPhoto(null);
    }
    e.target.value = '';
  }

  const err = (name: string) =>
    state.fieldErrors?.[name] ? root('auth.errors.validation') : undefined;

  return (
    <form ref={form} action={action} className="space-y-4" noValidate>
      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="kind" label={t('fields.kind')}>
            <Select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              {NOTICE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`kinds.${k}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="category" label={t('fields.category')}>
            <Select
              id="category"
              name="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as NoticeCategory)}
            >
              {NOTICE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`categories.${c}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {category === 'gear' && kind === 'offer' ? (
          <p className="rounded-xl bg-brand-blue/10 p-3 text-sm">
            {t('gearHint')}{' '}
            <Link href="/market/new" className="font-semibold underline">
              {t('marketNew')}
            </Link>
          </p>
        ) : null}
        <Field
          id="title"
          label={t('fields.title')}
          help={t('fields.titleHelp')}
          error={err('title')}
        >
          <Input id="title" name="title" required minLength={3} maxLength={120} />
        </Field>
        <Field id="body" label={t('fields.body')} error={err('body')}>
          <Textarea id="body" name="body" rows={3} maxLength={2000} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="site_id" label={t('fields.site')}>
            <Select id="site_id" name="site_id" defaultValue="">
              <option value="">—</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            id="place_text"
            label={t('fields.place')}
            help={t('fields.placeHelp')}
            error={err('place_text')}
          >
            <Input id="place_text" name="place_text" maxLength={120} />
          </Field>
          <Field id="notice_date" label={t('fields.date')} error={err('notice_date')}>
            <Input id="notice_date" name="notice_date" type="date" />
          </Field>
          {category === 'transport' ? (
            <Field id="seats" label={t('fields.seats')} error={err('seats')}>
              <Input id="seats" name="seats" type="number" min={1} max={8} inputMode="numeric" />
            </Field>
          ) : (
            <div className="grid grid-cols-[1fr_7rem] gap-2">
              <Field id="price" label={t('fields.price')} error={err('price')}>
                <Input id="price" name="price" inputMode="decimal" />
              </Field>
              <Field id="currency" label={t('fields.currency')}>
                <Select id="currency" name="currency" defaultValue="TRY">
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
        </div>
        <Field id="photo" label={t('fields.photo')} help={t('fields.photoHelp')}>
          <Input
            id="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            onChange={pick}
          />
        </Field>
        {photo ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
            <img src={photo.preview} alt="" className="size-20 rounded-lg object-cover" />
            <Button type="button" variant="secondary" onClick={() => setPhoto(null)}>
              {t('fields.removePhoto')}
            </Button>
          </div>
        ) : null}
        <p className="text-sm text-muted">{t('privacyNote')}</p>
      </Card>
      <FormMessage state={state} success={t('posted')} />
      <SubmitButton>{t('post')}</SubmitButton>
    </form>
  );
}
