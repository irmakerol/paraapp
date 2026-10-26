'use client';
import { useActionState, useId } from 'react';
import { useTranslations } from 'next-intl';
import { REPORT_REASONS, type ReportTarget } from '@paraapp/core';
import { initialState } from '@/lib/action-state';
import { fileReport } from '@/lib/community-actions';
import { FormMessage } from './form-message';
import { SubmitButton } from './submit-button';
import { Field, Select, Textarea } from './ui';

/** A small "Report" disclosure with the report form inside. */
export function ReportButton({
  targetType,
  targetId,
  className,
}: {
  targetType: ReportTarget;
  targetId: string;
  className?: string;
}) {
  const t = useTranslations('common');
  const [state, action] = useActionState(fileReport, initialState);
  const id = useId();
  return (
    <details className={`group ${className ?? ''}`}>
      <summary className="cursor-pointer list-none text-sm text-muted underline-offset-2 hover:underline">
        {t('report')}
      </summary>
      <div className="mt-2 rounded-xl border border-border bg-card p-4 shadow-sm">
        {state.ok ? (
          <FormMessage state={state} success={t('reportSent')} />
        ) : (
          <form action={action} className="space-y-3">
            <p className="font-semibold">{t('reportTitle')}</p>
            <input type="hidden" name="target_type" value={targetType} />
            <input type="hidden" name="target_id" value={targetId} />
            <Field id={`${id}-reason`} label={t('reportReason')}>
              <Select id={`${id}-reason`} name="reason" required defaultValue="spam">
                {REPORT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`reasons.${r}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id={`${id}-details`} label={t('reportDetails')}>
              <Textarea id={`${id}-details`} name="details" maxLength={2000} />
            </Field>
            <FormMessage state={state} />
            <SubmitButton variant="secondary">{t('reportSend')}</SubmitButton>
          </form>
        )}
      </div>
    </details>
  );
}
