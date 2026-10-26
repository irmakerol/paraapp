'use client';
import { useLocale, useTranslations } from 'next-intl';
import { TipForm, type TipValues } from '@/components/tip-form';
import { Field, Select, Textarea } from '@/components/ui';
import { saveTipAdmin } from './actions';

export function AdminTipForm({
  id,
  values,
  status,
  reviewNote,
}: {
  id: string | null;
  values: TipValues;
  status: string;
  reviewNote: string;
}) {
  const t = useTranslations('tips');
  const admin = useTranslations('admin');
  const common = useTranslations('common');
  const locale = useLocale();
  return (
    <TipForm
      action={saveTipAdmin.bind(null, id)}
      values={values}
      submitLabel={common('save')}
      success={common('saved')}
    >
      <input type="hidden" name="locale" value={locale} />
      <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
        <Field id="status" label={admin('newsForm.status')}>
          <Select id="status" name="status" defaultValue={status}>
            {(['draft', 'pending_review', 'published', 'rejected'] as const).map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="review_note" label={admin('tipsAdmin.note')}>
          <Textarea
            id="review_note"
            name="review_note"
            rows={2}
            maxLength={1000}
            defaultValue={reviewNote}
          />
        </Field>
      </div>
    </TipForm>
  );
}
