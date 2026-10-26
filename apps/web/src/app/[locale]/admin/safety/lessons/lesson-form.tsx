'use client';
import { useActionState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { INCIDENT_CATEGORIES, INCIDENT_SEVERITIES } from '@paraapp/core';
import { initialState } from '@/lib/action-state';
import { Card, Field, Input, Select, Textarea } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { FormMessage } from '@/components/form-message';
import { saveLesson } from '../actions';

export interface LessonValues {
  title: string;
  locale: string;
  summary: string;
  body_md: string;
  category: string;
  severity: string;
  status: string;
}

export function LessonForm({ id, values }: { id: string | null; values: LessonValues }) {
  const t = useTranslations('admin.safetyAdmin');
  const s = useTranslations('safety');
  const common = useTranslations('common');
  const errorsT = useTranslations('auth.errors');
  const locale = useLocale();
  const [state, action] = useActionState(saveLesson.bind(null, id), initialState);
  const err = (name: string) => (state.fieldErrors?.[name] ? errorsT('validation') : undefined);
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <p className="text-sm text-muted">{t('lessonPrivacy')}</p>
      <Card className="space-y-5">
        <Field id="title" label={t('lessonTitle')} error={err('title')}>
          <Input id="title" name="title" required maxLength={160} defaultValue={values.title} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field id="lesson-locale" label={t('language')}>
            <Select id="lesson-locale" name="locale" defaultValue={values.locale}>
              <option value="tr">Türkçe</option>
              <option value="en">English</option>
            </Select>
          </Field>
          <Field id="category" label={t('category')}>
            <Select id="category" name="category" defaultValue={values.category}>
              {INCIDENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {s(`categories.${c}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="severity" label={t('severity')}>
            <Select id="severity" name="severity" defaultValue={values.severity}>
              {INCIDENT_SEVERITIES.map((v) => (
                <option key={v} value={v}>
                  {s(`severities.${v}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="status" label={t('status')}>
            <Select id="status" name="status" defaultValue={values.status}>
              <option value="draft">{t('draft')}</option>
              <option value="published">{t('published')}</option>
            </Select>
          </Field>
        </div>
        <Field id="summary" label={t('summary')} error={err('summary')}>
          <Textarea
            id="summary"
            name="summary"
            rows={2}
            maxLength={400}
            defaultValue={values.summary}
          />
        </Field>
        <Field id="body_md" label={t('body')} help={t('markdownHelp')} error={err('body_md')}>
          <Textarea
            id="body_md"
            name="body_md"
            rows={14}
            maxLength={20000}
            defaultValue={values.body_md}
          />
        </Field>
      </Card>
      <FormMessage state={state} success={common('saved')} />
      <SubmitButton>{common('save')}</SubmitButton>
    </form>
  );
}
