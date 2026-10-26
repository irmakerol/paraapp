'use client';
import { useActionState, useEffect, useRef, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { DIFFICULTIES, TIP_CATEGORIES } from '@paraapp/core';
import { initialState, type ActionState } from '@/lib/action-state';
import { Field, Input, Select, Textarea } from './ui';
import { FormMessage } from './form-message';
import { SubmitButton } from './submit-button';

export interface TipValues {
  title: string;
  locale: string;
  summary: string;
  body_md: string;
  category: string;
  difficulty: string;
  video_url: string;
}

const empty: TipValues = {
  title: '',
  locale: 'tr',
  summary: '',
  body_md: '',
  category: 'beginner_faq',
  difficulty: 'beginner',
  video_url: '',
};

/** Used by "Suggest a tip" and by the admin tip editor (which adds extra fields). */
export function TipForm({
  action,
  values = empty,
  submitLabel,
  success,
  resetOnSuccess = false,
  children,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  values?: TipValues;
  submitLabel: string;
  success: string;
  resetOnSuccess?: boolean;
  children?: ReactNode;
}) {
  const t = useTranslations('tips');
  const root = useTranslations();
  const [state, formAction] = useActionState(action, initialState);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) form.current?.reset();
  }, [state, resetOnSuccess]);
  const err = (name: string) => {
    const key = state.fieldErrors?.[name];
    if (!key) return undefined;
    return key.includes('.') ? root(key) : root(`auth.errors.${key}`);
  };

  return (
    <form ref={form} action={formAction} className="space-y-5" noValidate>
      <Field id="title" label={t('fields.title')} error={err('title')}>
        <Input
          id="title"
          name="title"
          required
          minLength={3}
          maxLength={160}
          defaultValue={values.title}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="category" label={t('fields.category')}>
          <Select id="category" name="category" defaultValue={values.category}>
            {TIP_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="difficulty" label={t('fields.difficulty')}>
          <Select id="difficulty" name="difficulty" defaultValue={values.difficulty}>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {t(`difficulty.${d}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="tip_locale" label={t('fields.locale')}>
          <Select id="tip_locale" name="tip_locale" defaultValue={values.locale}>
            <option value="tr">Türkçe</option>
            <option value="en">English</option>
          </Select>
        </Field>
      </div>
      <Field id="summary" label={t('fields.summary')} error={err('summary')}>
        <Input id="summary" name="summary" maxLength={300} defaultValue={values.summary} />
      </Field>
      <Field id="body_md" label={t('fields.body')} error={err('body_md')}>
        <Textarea
          id="body_md"
          name="body_md"
          required
          minLength={20}
          maxLength={30000}
          rows={12}
          defaultValue={values.body_md}
        />
      </Field>
      <Field id="video_url" label={t('fields.video')} error={err('video_url')}>
        <Input
          id="video_url"
          name="video_url"
          type="url"
          inputMode="url"
          placeholder="https://www.youtube.com/watch?v=…"
          defaultValue={values.video_url}
        />
      </Field>
      {children}
      <FormMessage state={state} success={success} />
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
