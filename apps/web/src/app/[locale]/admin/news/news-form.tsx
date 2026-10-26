'use client';
import { useActionState, useState, useTransition } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { slugify } from '@paraapp/core';
import { initialState } from '@/lib/action-state';
import { createClient } from '@/lib/supabase/client';
import { resizeImage } from '@/lib/image';
import { publicEnv } from '@/lib/env';
import { Field, Input, Select, Textarea } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import { saveNews } from './actions';

export interface NewsValues {
  title: string;
  slug: string;
  locale: string;
  summary: string;
  body_md: string;
  tags: string;
  cover_path: string;
  members_only: boolean;
  pinned: boolean;
  comments_enabled: boolean;
  notify_on_publish: boolean;
  status: 'draft' | 'published';
  published_at: string;
}

export function NewsForm({ id, values }: { id: string | null; values: NewsValues }) {
  const t = useTranslations('admin.newsForm');
  const root = useTranslations();
  const locale = useLocale();
  const [state, action] = useActionState(saveNews.bind(null, id), initialState);
  const [slug, setSlug] = useState(values.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(values.slug));
  const [cover, setCover] = useState(values.cover_path);
  const [uploading, start] = useTransition();

  const err = (name: string) => {
    const key = state.fieldErrors?.[name];
    return key ? (key.includes('.') ? root(key) : root(`auth.errors.${key}`)) : undefined;
  };

  function uploadCover(file: File | undefined) {
    if (!file) return;
    start(async () => {
      const blob = await resizeImage(file, 1600, 0.82);
      const path = `news/${crypto.randomUUID()}.webp`;
      const { error } = await createClient()
        .storage.from('content')
        .upload(path, blob, { contentType: 'image/webp' });
      if (!error) setCover(path);
    });
  }

  const check = (name: keyof NewsValues, label: string) => (
    <label className="flex items-center gap-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={Boolean(values[name])}
        className="size-5"
      />
      {label}
    </label>
  );

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="cover_path" value={cover} />
      <Field id="title" label={t('title')} error={err('title')}>
        <Input
          id="title"
          name="title"
          required
          maxLength={160}
          defaultValue={values.title}
          onChange={(e) => {
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <Field id="slug" label={t('slug')} error={err('slug')}>
          <Input
            id="slug"
            name="slug"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
          />
        </Field>
        <Field id="news_locale" label={t('locale')}>
          <Select id="news_locale" name="news_locale" defaultValue={values.locale}>
            <option value="tr">Türkçe</option>
            <option value="en">English</option>
          </Select>
        </Field>
      </div>
      <Field id="summary" label={t('summary')} error={err('summary')}>
        <Input id="summary" name="summary" maxLength={300} defaultValue={values.summary} />
      </Field>
      <Field id="body_md" label={t('body')} error={err('body_md')}>
        <Textarea id="body_md" name="body_md" rows={16} defaultValue={values.body_md} />
      </Field>
      <Field id="tags" label={t('tags')} error={err('tags')}>
        <Input id="tags" name="tags" defaultValue={values.tags} />
      </Field>
      <div className="space-y-2">
        <p className="text-sm font-semibold">{t('cover')}</p>
        {cover ? (
          <Image
            src={`${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/content/${cover}`}
            alt=""
            width={480}
            height={270}
            className="aspect-video w-full max-w-sm rounded-lg object-cover"
            unoptimized
          />
        ) : null}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={uploading}
          onChange={(e) => uploadCover(e.target.files?.[0])}
        />
      </div>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        {check('members_only', t('membersOnly'))}
        {check('pinned', t('pinned'))}
        {check('comments_enabled', t('comments'))}
        {check('notify_on_publish', t('notify'))}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="status" label={t('status')}>
          <Select id="status" name="status" defaultValue={values.status}>
            <option value="draft">{t('draft')}</option>
            <option value="published">{t('published')}</option>
          </Select>
        </Field>
        <Field id="published_at" label={t('publishAt')} error={err('published_at')}>
          <Input
            id="published_at"
            name="published_at"
            type="datetime-local"
            defaultValue={values.published_at}
          />
        </Field>
      </div>
      <FormMessage state={state} success={t('saved')} />
      <SubmitButton disabled={uploading}>{root('common.save')}</SubmitButton>
    </form>
  );
}
