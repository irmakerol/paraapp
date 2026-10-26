'use client';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { initialState } from '@/lib/action-state';
import { Alert } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { confirmGuardian } from '../../onboarding/actions';

export function GuardianConfirmForm({ token }: { token: string }) {
  const t = useTranslations('guardianConfirm');
  const [state, action] = useActionState(confirmGuardian, initialState);
  if (state.ok) return <Alert tone="success">{t('confirmed')}</Alert>;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.error ? <Alert tone="error">{t('invalid')}</Alert> : null}
      <SubmitButton>{t('confirm')}</SubmitButton>
    </form>
  );
}
